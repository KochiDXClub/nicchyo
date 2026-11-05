// PreToolUse: .env 系ファイルへの編集をブロック
// Claude Code はフックの入力を標準入力に JSON で渡す（{ tool_name, tool_input: { file_path, ... } }）
let input = {};
try {
  input = JSON.parse(require('fs').readFileSync(0, 'utf8')).tool_input || {};
} catch (_) {}
const filePath = (input.file_path || '').replace(/\\/g, '/');
if (filePath.match(/\.env(\.|$)/)) {
  console.error('BLOCK: .env ファイルは保護されています。必要な場合は手動で編集してください。');
  process.exit(2);
}
