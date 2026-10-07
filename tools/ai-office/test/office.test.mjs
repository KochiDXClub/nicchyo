import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, normalizeEvent, IDLE_SLEEP_MS, REMOVE_MS } from '../lib/state.mjs';
import { createOfficeServer } from '../server.mjs';

const evt = (type, extra = {}) => normalizeEvent({ session_id: 's1', source_app: 'nicchyo', hook_event_type: type, ...extra });

test('normalizeEvent: 不正な入力を弾く', () => {
  assert.equal(normalizeEvent(null), null);
  assert.equal(normalizeEvent({ session_id: 'a b', hook_event_type: 'Stop' }), null);
  assert.equal(normalizeEvent({ session_id: 's1' }), null);
  assert.equal(normalizeEvent({ session_id: 's1', hook_event_name: 'Stop' }).hook_event_type, 'Stop');
});

test('状態遷移: 作業 → 承認待ち → 作業 → 待機', () => {
  const store = createStore();
  assert.equal(store.apply(evt('SessionStart')).session.status, 'idle');
  assert.equal(store.apply(evt('PreToolUse', { tool_name: 'Edit', detail: 'a.ts' })).session.tool, 'Edit');
  assert.equal(store.apply(evt('Notification', { message: '許可してください' })).session.status, 'waiting');
  assert.equal(store.apply(evt('PreToolUse', { tool_name: 'Bash' })).session.status, 'working');
  assert.equal(store.apply(evt('Notification', { notification_type: 'idle_prompt' })).session.status, 'idle');
  assert.equal(store.apply(evt('Stop')).session.status, 'idle');
});

test('サブエージェントの増減と Stop でのクリア', () => {
  const store = createStore();
  store.apply(evt('SubagentStart', { agent_id: 'a1' }));
  assert.equal(store.apply(evt('SubagentStart', { agent_id: 'a2' })).session.subagents, 2);
  assert.equal(store.apply(evt('SubagentStop', { agent_id: 'a1' })).session.subagents, 1);
  assert.equal(store.apply(evt('Stop')).session.subagents, 0);
});

test('SessionEnd で退社し、スナップショットから消える', () => {
  const store = createStore();
  store.apply(evt('SessionStart'));
  const result = store.apply(evt('SessionEnd'));
  assert.equal(result.removed, true);
  assert.equal(result.session.status, 'left');
  assert.equal(store.snapshot().sessions.length, 0);
});

test('sweep: 無信号は sleeping、さらに古いと削除', () => {
  let now = 1_000;
  const store = createStore({ now: () => now });
  store.apply(evt('Stop'));
  now += IDLE_SLEEP_MS + 1;
  assert.equal(store.sweep().changed[0].status, 'sleeping');
  now += REMOVE_MS;
  assert.deepEqual(store.sweep().removed, ['s1']);
});

async function withServer(options, fn) {
  const server = createOfficeServer(options);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}

const post = (base, body, token = 'secret') =>
  fetch(`${base}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

test('サーバー: トークン検証・受信・スナップショット', async () => {
  await withServer({ token: 'secret' }, async (base) => {
    const body = { session_id: 's1', source_app: 'nicchyo', hook_event_type: 'PreToolUse', tool_name: 'Edit' };
    assert.equal((await post(base, body, 'wrong')).status, 401);
    assert.equal((await post(base, { nope: 1 })).status, 400);
    assert.equal((await post(base, body)).status, 200);
    const state = await (await fetch(`${base}/state`)).json();
    assert.equal(state.sessions[0].tool, 'Edit');
  });
});

test('サーバー: 閲覧キー・静的配信の制限', async () => {
  await withServer({ token: 'secret', viewKey: 'view' }, async (base) => {
    assert.equal((await fetch(`${base}/state`)).status, 401);
    assert.equal((await fetch(`${base}/state?key=view`)).status, 200);
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/shared/state.mjs`)).status, 200);
    assert.equal((await fetch(`${base}/vendor/three/build/three.module.js`)).status, 200);
    assert.equal((await fetch(`${base}/vendor/three/package.json`)).status, 404);
    assert.equal((await fetch(`${base}/shared/..%2Fserver.mjs`)).status, 404);
  });
});

test('サーバー: SSE が snapshot と update を流す', async () => {
  await withServer({ token: 'secret' }, async (base) => {
    const ctrl = new AbortController();
    const res = await fetch(`${base}/stream`, { signal: ctrl.signal });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    const readUntil = async (needle) => {
      while (!text.includes(needle)) {
        const { value, done } = await reader.read();
        if (done) break;
        text += decoder.decode(value);
      }
    };
    await readUntil('event: snapshot');
    await post(base, { session_id: 's9', source_app: 'x', hook_event_type: 'UserPromptSubmit' });
    await readUntil('event: update');
    assert.match(text, /"id":"s9"/);
    ctrl.abort();
  });
});
