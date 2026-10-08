// PostToolUse: Supabase マイグレーション SQL の RLS 漏れを警告
const input = JSON.parse(process.env.CLAUDE_TOOL_INPUT || '{}');
const filePath = (input.file_path || '').replace(/\\/g, '/');
if (!filePath.includes('supabase/migrations') || !filePath.endsWith('.sql')) process.exit(0);

const fs = require('fs');
try {
  const sql = fs.readFileSync(filePath, 'utf8');
  const hasCreate = /CREATE TABLE/i.test(sql);
  const hasRls    = /ENABLE ROW LEVEL SECURITY/i.test(sql);
  const hasPolicy = /CREATE POLICY/i.test(sql);

  if (hasCreate && !hasRls) {
    console.error('⚠️  RLS警告: CREATE TABLE が検出されましたが ENABLE ROW LEVEL SECURITY がありません。');
  }
  if (hasRls && !hasPolicy) {
    console.error('⚠️  RLS警告: RLS が有効ですがポリシーが未定義です。CREATE POLICY を追加してください。');
  }
} catch (_) {}
