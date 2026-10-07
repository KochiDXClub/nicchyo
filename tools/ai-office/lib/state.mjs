// セッション状態の集約ロジック。サーバー（本番）とブラウザ（?demo=1）の両方から使う。
// DOM・Node 固有 API には依存させないこと。

export const IDLE_SLEEP_MS = 15 * 60 * 1000;
export const WORKING_SLEEP_MS = 30 * 60 * 1000;
export const REMOVE_MS = 3 * 60 * 60 * 1000;
export const MAX_SESSIONS = 60;
export const MAX_EVENTS = 200;

const SESSION_ID_RE = /^[\w.:-]{1,80}$/;

function str(value, max) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

/** フック側から届いた生 JSON を検証・整形する。不正なら null。 */
export function normalizeEvent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = str(raw.hook_event_type ?? raw.hook_event_name, 40);
  const sessionId = str(raw.session_id, 80);
  if (!type || !sessionId || !SESSION_ID_RE.test(sessionId)) return null;
  return {
    session_id: sessionId,
    hook_event_type: type,
    source_app: str(raw.source_app, 60) ?? 'unknown',
    tool_name: str(raw.tool_name, 60),
    detail: str(raw.detail, 100),
    message: str(raw.message, 160),
    notification_type: str(raw.notification_type, 40),
    agent_id: str(raw.agent_id, 80),
    agent_type: str(raw.agent_type, 60),
    model: str(raw.model, 60),
  };
}

export function createStore({ now = Date.now } = {}) {
  /** @type {Map<string, any>} */
  const sessions = new Map();
  /** @type {Map<string, Set<string>>} sessionId -> 稼働中サブエージェント ID */
  const agents = new Map();
  const events = [];
  let seq = 0;
  let anonAgent = 0;

  const publicSession = (s) => ({
    id: s.id,
    short: s.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4),
    project: s.project,
    status: s.status,
    tool: s.tool,
    detail: s.detail,
    message: s.message,
    subagents: agents.get(s.id)?.size ?? 0,
    model: s.model,
    startedAt: s.startedAt,
    lastSeen: s.lastSeen,
    errorAt: s.errorAt,
    eventCount: s.eventCount,
  });

  function ensure(evt, ts) {
    let s = sessions.get(evt.session_id);
    if (!s) {
      if (sessions.size >= MAX_SESSIONS) {
        const oldest = [...sessions.values()].sort((a, b) => a.lastSeen - b.lastSeen)[0];
        sessions.delete(oldest.id);
        agents.delete(oldest.id);
      }
      s = {
        id: evt.session_id,
        project: evt.source_app,
        status: 'idle',
        tool: null,
        detail: null,
        message: null,
        model: null,
        startedAt: ts,
        lastSeen: ts,
        errorAt: 0,
        eventCount: 0,
      };
      sessions.set(s.id, s);
      agents.set(s.id, new Set());
    }
    return s;
  }

  /** イベントを適用する。{ session, event, removed } を返す。 */
  function apply(evt) {
    const ts = now();
    const s = ensure(evt, ts);
    s.lastSeen = ts;
    s.eventCount += 1;
    if (evt.source_app !== 'unknown') s.project = evt.source_app;
    if (evt.model) s.model = evt.model;
    const subs = agents.get(s.id);
    let removed = false;

    switch (evt.hook_event_type) {
      case 'SessionStart':
        s.status = 'idle';
        s.tool = null;
        s.detail = null;
        s.message = null;
        subs.clear();
        break;
      case 'UserPromptSubmit':
        s.status = 'working';
        s.tool = 'thinking';
        s.detail = null;
        s.message = null;
        break;
      case 'PreToolUse':
      case 'PostToolUse':
        s.status = 'working';
        s.tool = evt.tool_name ?? s.tool ?? 'thinking';
        s.detail = evt.detail ?? null;
        s.message = null;
        break;
      case 'PostToolUseFailure':
        s.status = 'working';
        s.tool = evt.tool_name ?? s.tool;
        s.errorAt = ts;
        break;
      case 'PermissionRequest':
        s.status = 'waiting';
        s.tool = evt.tool_name ?? s.tool;
        s.detail = evt.detail ?? null;
        s.message = evt.message ?? '承認待ち';
        break;
      case 'Notification':
        // idle_prompt は「作業が終わって入力待ち」。それ以外（許可確認など）は承認待ち。
        if (evt.notification_type === 'idle_prompt') {
          s.status = 'idle';
          s.tool = null;
        } else {
          s.status = 'waiting';
          s.message = evt.message ?? '呼ばれています';
        }
        break;
      case 'PreCompact':
        s.status = 'working';
        s.tool = 'compact';
        s.detail = null;
        break;
      case 'SubagentStart':
        subs.add(evt.agent_id ?? `anon-${(anonAgent += 1)}`);
        s.status = 'working';
        break;
      case 'SubagentStop':
        if (evt.agent_id && subs.has(evt.agent_id)) subs.delete(evt.agent_id);
        else if (subs.size) subs.delete(subs.values().next().value);
        break;
      case 'Stop':
        s.status = 'idle';
        s.tool = null;
        s.detail = null;
        s.message = null;
        subs.clear();
        break;
      case 'SessionEnd':
        s.status = 'left';
        removed = true;
        break;
      default:
        break;
    }

    const session = publicSession(s);
    if (removed) {
      sessions.delete(s.id);
      agents.delete(s.id);
    }
    const event = {
      id: (seq += 1),
      ts,
      session_id: s.id,
      project: session.project,
      type: evt.hook_event_type,
      tool: evt.tool_name ?? null,
      detail: evt.detail ?? null,
      message: evt.message ?? null,
    };
    events.push(event);
    if (events.length > MAX_EVENTS) events.shift();
    return { session, event, removed };
  }

  /** 無信号セッションを sleeping に、古すぎるものを削除する。 */
  function sweep() {
    const ts = now();
    const changed = [];
    const removed = [];
    for (const s of [...sessions.values()]) {
      const age = ts - s.lastSeen;
      if (age > REMOVE_MS) {
        sessions.delete(s.id);
        agents.delete(s.id);
        removed.push(s.id);
      } else if (s.status !== 'sleeping') {
        const limit = s.status === 'idle' ? IDLE_SLEEP_MS : WORKING_SLEEP_MS;
        if (age > limit) {
          s.status = 'sleeping';
          agents.get(s.id)?.clear();
          changed.push(publicSession(s));
        }
      }
    }
    return { changed, removed };
  }

  const snapshot = () => ({
    sessions: [...sessions.values()].map(publicSession),
    events: [...events],
  });

  return { apply, sweep, snapshot };
}
