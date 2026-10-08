// PreToolUse: .env 系ファイルへの編集をブロック
const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const filePath = (input.file_path || '').replace(/\\/g, '/');
if (filePath.match(/\.env(\.|$)/)) {
  console.error('BLOCK: .env ファイルは保護されています。必要な場合は手動で編集してください。');
  process.exit(2);
}
