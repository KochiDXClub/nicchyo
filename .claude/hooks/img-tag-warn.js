// PostToolUse: Next.js で <img> タグを使っていたら警告
const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const filePath = (input.file_path || '').replace(/\\/g, '/');
if (!filePath || !/\.(tsx|jsx)$/.test(filePath)) process.exit(0);
if (filePath.includes('node_modules')) process.exit(0);

const fs = require('fs');
try {
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(/<img\s/g) || [];
  if (matches.length > 0) {
    console.error(`⚠️  Next.js: <img> タグが ${matches.length} 箇所あります。next/image の <Image> コンポーネントへの置き換えを検討してください。`);
  }
} catch (_) {}
