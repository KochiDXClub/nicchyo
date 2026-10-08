#!/usr/bin/env node
// Claude Code の hooks から呼ばれ、イベントを AI Office サーバーへ送る。
// - 標準出力には何も書かない（フックの stdout は Claude のコンテキストに入ることがあるため）
// - 失敗しても必ず exit 0（Claude の作業を絶対に止めない）
// - 送るのはイベント種別・ツール名・短い対象名と、「いま何をしているか」の一言だけ。
//   一言 = プロンプトの 1 行目（60 文字まで）/ TodoWrite の進行中項目 / サブエージェントへの依頼文（description）。
//   プロンプト全文・ファイルの中身・コマンド全文は送らない
//
// 環境変数:
//   AI_OFFICE_URL     サーバー URL（例 https://office.example.com）。未設定なら何もしない
//   AI_OFFICE_TOKEN   送信用トークン
//   AI_OFFICE_APP     表示名（既定: 作業ディレクトリ名）
//   AI_OFFICE_DETAIL  full にすると Bash のコマンド先頭 60 文字や検索語も送る（既定 minimal）。
//                     先頭の NAME=value の値は伏せるが、それ以外の引数・検索語・URL に秘密が入っていても伏せられない
//   AI_OFFICE_TASKS   off にすると「一言」（プロンプト 1 行目・Todo・依頼文）を一切送らない
import path from 'node:path';

const DETAIL_FULL = process.env.AI_OFFICE_DETAIL === 'full';
const TASKS_ON = process.env.AI_OFFICE_TASKS !== 'off';
const DELEGATE_TOOLS = new Set(['Task', 'Agent']);

/** 1 行に潰して max 文字に収める */
function oneLine(value, max) {
  if (typeof value !== 'string') return undefined;
  const line = value.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
  if (!line) return undefined;
  const chars = Array.from(line.replace(/\s+/g, ' '));
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : chars.join('');
}

// `相談(security-reviewer→legal-counsel): 規約の確認` / `consult(a->b): …`。矢印は → > ＞ -> のどれでもよい
function parseConsult(description) {
  if (!description) return undefined;
  const match = description.match(/^(?:相談|consult)\s*[(（]\s*([^→>＞)）]+?)\s*(?:→|->|＞|>)\s*[^)）]+?\s*[)）]\s*[:：]?\s*(.*)$/i);
  if (!match) return undefined;
  const from = match[1].trim();
  return from ? { from: from.slice(0, 40), brief: match[2].trim() || undefined } : undefined;
}

function todoSummary(input) {
  const todos = Array.isArray(input?.todos) ? input.todos : [];
  if (!todos.length) return {};
  const current = todos.find((t) => t?.status === 'in_progress');
  const done = todos.filter((t) => t?.status === 'completed').length;
  return {
    task: oneLine(current?.activeForm ?? current?.content, 60),
    todo_progress: `${done}/${todos.length}`,
  };
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

// `FOO=secret cmd` のような、先頭の環境変数の代入（値は "..." / '...' / 空白なしの語）
const ENV_PREFIX = /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"[^"]*"|'[^']*'|\S*)(?:\s+|$))+/;

/** コマンド名だけを取り出す。先頭の `NAME=value` は読み飛ばす（値に秘密が入りうるため） */
function commandName(command) {
  const word = command.replace(ENV_PREFIX, '').split(/\s+/)[0];
  return word ? path.basename(word) : undefined;
}

/** full モード用: 先頭の `NAME=value` の値を伏せる */
function maskEnvPrefix(command) {
  return command.replace(ENV_PREFIX, (prefix) => prefix.replace(/=(?:"[^"]*"|'[^']*'|\S*)/g, '=***'));
}

function describe(toolName, input) {
  if (!input || typeof input !== 'object') return undefined;
  const file = input.file_path ?? input.notebook_path ?? input.path;
  if (typeof file === 'string') return path.basename(file);
  if (toolName === 'Bash' && typeof input.command === 'string') {
    const trimmed = input.command.trim();
    return DETAIL_FULL ? maskEnvPrefix(trimmed).slice(0, 60) : commandName(trimmed);
  }
  if (DETAIL_FULL) {
    const text = input.pattern ?? input.query ?? input.url ?? input.description;
    if (typeof text === 'string') return text.slice(0, 60);
  }
  return undefined;
}

async function main() {
  const base = process.env.AI_OFFICE_URL;
  if (!base) return;
  let input;
  try {
    input = JSON.parse(await readStdin());
  } catch {
    return;
  }
  const tool = input.tool_name;
  const toolInput = input.tool_input ?? {};
  const extra = {};
  if (TASKS_ON && input.hook_event_name === 'UserPromptSubmit') {
    extra.task = oneLine(input.prompt, 60);
    extra.task_source = 'prompt';
  }
  if (TASKS_ON && tool === 'TodoWrite') Object.assign(extra, todoSummary(toolInput), { task_source: 'todo' });
  if (TASKS_ON && tool === 'TaskCreate') {
    extra.todo_op = 'create';
    extra.todo_subject = oneLine(toolInput.subject, 60);
    extra.todo_active = oneLine(toolInput.activeForm, 60);
  }
  if (TASKS_ON && tool === 'TaskUpdate') {
    extra.todo_op = 'update';
    extra.todo_id = typeof toolInput.taskId === 'string' || typeof toolInput.taskId === 'number' ? String(toolInput.taskId) : undefined;
    extra.todo_status = typeof toolInput.status === 'string' ? toolInput.status : undefined;
    extra.todo_subject = oneLine(toolInput.subject, 60);
    extra.todo_active = oneLine(toolInput.activeForm, 60);
  }
  if (DELEGATE_TOOLS.has(tool)) {
    extra.delegate_role = oneLine(toolInput.subagent_type, 40) ?? 'general-purpose';
    // 相談の取り決め: description を `相談(依頼元→相談先): 一言` の形で書くと、「◯◯に代わって専門家に聞きに行く」と表示される
    const consult = parseConsult(oneLine(toolInput.description, 80));
    if (consult) extra.consult_from = consult.from;
    if (TASKS_ON) extra.delegate_brief = oneLine(consult ? consult.brief : (toolInput.description ?? toolInput.prompt), 40);
  }
  if (tool === 'SendMessage') {
    extra.talk_to = oneLine(toolInput.to ?? toolInput.recipient, 40);
    if (TASKS_ON) extra.talk_text = oneLine(toolInput.summary ?? toolInput.message, 60);
  }
  const payload = {
    source_app: process.env.AI_OFFICE_APP || path.basename(input.cwd || process.cwd()),
    session_id: input.session_id,
    hook_event_type: input.hook_event_name,
    tool_name: input.tool_name,
    detail: describe(input.tool_name, input.tool_input),
    message: input.hook_event_name === 'Notification' ? oneLine(input.message, 80) : undefined,
    notification_type: input.notification_type,
    agent_id: input.agent_id,
    agent_type: input.agent_type,
    model: typeof input.model === 'string' ? input.model : undefined,
    ...extra,
  };
  await fetch(new URL('/events', base), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.AI_OFFICE_TOKEN ?? ''}`,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(2000),
  });
}

main()
  .catch(() => {})
  .finally(() => process.exit(0));
