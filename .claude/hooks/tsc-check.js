// PostToolUse: TypeScript 型チェック（worktree 対応）
const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const filePath = (input.file_path || '').replace(/\\/g, '/');
if (!filePath) process.exit(0);

const path = require('path');
const { spawnSync } = require('child_process');

try {
  const dir = path.dirname(filePath);
  const gitResult = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8', shell: true
  });
  if (gitResult.status !== 0) process.exit(0);
  const root = gitResult.stdout.trim().replace(/\\/g, '/');

  const result = spawnSync('npx', ['tsc', '--noEmit', '--skipLibCheck'], {
    encoding: 'utf8', shell: true, cwd: root
  });
  const out = (result.stdout || '') + (result.stderr || '');
  const errors = (out.match(/error TS[^\n]+/g) || []).slice(0, 10);
  if (errors.length) console.error(errors.join('\n'));
} catch (_) {}
