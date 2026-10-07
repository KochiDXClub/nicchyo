#!/usr/bin/env node
// Claude Code の hooks から呼ばれ、イベントを AI Office サーバーへ送る。
// - 標準出力には何も書かない（フックの stdout は Claude のコンテキストに入ることがあるため）
// - 失敗しても必ず exit 0（Claude の作業を絶対に止めない）
// - 送るのはイベント種別・ツール名・短い対象名だけ。プロンプト本文・ファイル内容・コマンド全文は送らない
//
// 環境変数:
//   AI_OFFICE_URL     サーバー URL（例 https://office.example.com）。未設定なら何もしない
//   AI_OFFICE_TOKEN   送信用トークン
//   AI_OFFICE_APP     表示名（既定: 作業ディレクトリ名）
//   AI_OFFICE_DETAIL  full にすると Bash のコマンド先頭や検索語も送る（既定 minimal）
import path from 'node:path';

const DETAIL_FULL = process.env.AI_OFFICE_DETAIL === 'full';

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

function describe(toolName, input) {
  if (!input || typeof input !== 'object') return undefined;
  const file = input.file_path ?? input.notebook_path ?? input.path;
  if (typeof file === 'string') return path.basename(file);
  if (toolName === 'Bash' && typeof input.command === 'string') {
    const trimmed = input.command.trim();
    return DETAIL_FULL ? trimmed.slice(0, 60) : trimmed.split(/\s+/)[0];
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
  const payload = {
    source_app: process.env.AI_OFFICE_APP || path.basename(input.cwd || process.cwd()),
    session_id: input.session_id,
    hook_event_type: input.hook_event_name,
    tool_name: input.tool_name,
    detail: describe(input.tool_name, input.tool_input),
    message: input.hook_event_name === 'Notification' ? input.message : undefined,
    notification_type: input.notification_type,
    agent_id: input.agent_id,
    agent_type: input.agent_type,
    model: typeof input.model === 'string' ? input.model : undefined,
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
