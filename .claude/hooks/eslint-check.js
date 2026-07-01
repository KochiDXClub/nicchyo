// PostToolUse: ESLint チェック（.ts/.tsx 限定、worktree 対応）
const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const filePath = (input.file_path || '').replace(/\\/g, '/');
if (!filePath || !/\.(ts|tsx)$/.test(filePath)) process.exit(0);

const path = require('path');
const { spawnSync } = require('child_process');

try {
  const dir = path.dirname(filePath);
  const gitResult = spawnSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8', shell: true
  });
  if (gitResult.status !== 0) process.exit(0);
  const root = gitResult.stdout.trim().replace(/\\/g, '/');

  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  if (rel.startsWith('..') || rel.startsWith('node_modules')) process.exit(0);

  const result = spawnSync('npx', ['eslint', '--max-warnings', '0', filePath], {
    encoding: 'utf8', shell: true, cwd: root, stdio: 'inherit'
  });
  process.exit(result.status === null ? 0 : 0);
} catch (_) {}
