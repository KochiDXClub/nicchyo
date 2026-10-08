/**
 * 本番Supabaseからデータを取得してローカルDBに流し込むスクリプト。
 * supabase db dump がポート5432ブロックで使えない場合の代替手段。
 *
 * 使い方: node scripts/seed-local.mjs
 * 前提: npx supabase start でローカルSupabaseが起動済みであること
 *       .env.local に NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定済みであること
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// 本番の環境変数を読み込む（.env.local.production → シェル環境変数の順で試みる）
try {
  process.loadEnvFile(".env.local.production");
} catch {
  // ファイルがない場合はシェルの環境変数を使用する
}

const PROD_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PROD_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
if (!PROD_URL || !PROD_KEY) {
  throw new Error(
    "環境変数 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY を設定してください（.env.local.production に記載）"
  );
}

// ローカル Supabase の DB コンテナ名を動的に検出する
function detectDbContainer() {
  try {
    const names = execSync("docker ps --format '{{.Names}}'", { encoding: "utf8" });
    const match = names.split("\n").find((n) => n.startsWith("supabase_db_"));
    if (!match) throw new Error("supabase_db_* コンテナが見つかりません。npx supabase start を実行してください。");
    return match.trim();
  } catch (err) {
    throw new Error(`Docker コンテナ検出失敗: ${err.message}`);
  }
}

const DOCKER_CONTAINER = detectDbContainer();

// Node 20 以下は WebSocket がネイティブ未対応のため ws パッケージを使用する
let wsModule;
try {
  wsModule = (await import("ws")).default;
} catch {
  console.warn("ws パッケージが見つかりません。ネイティブ WebSocket にフォールバックします（Node 22+ は正常）。");
}
const prod = createClient(PROD_URL, PROD_KEY, wsModule ? { realtime: { transport: wsModule } } : {});

// 依存関係の順番に並べる（外部キー制約があるため）
const TABLES = [
  "categories",
  "market_locations",
  "vendors",
  "location_assignments",
  "products",
];

function escapeValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "'{}'";
    const escaped = value.map((v) =>
      typeof v === "string" ? `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : String(v)
    );
    return `'{${escaped.join(",")}}'`;
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function rowsToInsertSql(table, rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0])
    .map((c) => `"${c}"`)
    .join(", ");
  const values = rows
    .map((row) => `(${Object.values(row).map(escapeValue).join(", ")})`)
    .join(",\n  ");
  return `INSERT INTO "${table}" (${cols}) VALUES\n  ${values}\nON CONFLICT DO NOTHING;\n`;
}

function runSql(sql) {
  const tmpFile = join(tmpdir(), `seed_${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, "utf8");
  try {
    execSync(
      `docker exec -i "${DOCKER_CONTAINER}" psql -U postgres -d postgres < "${tmpFile}"`,
      { stdio: "pipe" }
    );
  } finally {
    unlinkSync(tmpFile);
  }
}

console.log("=== ローカルDBシード開始 ===\n");

// 全テーブルのデータを取得してから、1トランザクションでまとめて挿入する
const sqlParts = [];
for (const table of TABLES) {
  process.stdout.write(`${table} を取得中... `);
  const { data, error } = await prod.from(table).select("*");
  if (error) {
    console.error(`❌ 取得失敗: ${error.message}`);
    process.exit(1);
  }
  if (!data?.length) {
    console.log("データなし、スキップ");
    continue;
  }
  console.log(`${data.length} 件取得`);
  sqlParts.push(rowsToInsertSql(table, data));
}

if (sqlParts.length > 0) {
  console.log("\nローカルDBに挿入中...");
  // session_replication_role = replica で外部キーチェックを無効化し、全テーブルを1トランザクションで挿入
  const sql = [
    "BEGIN;",
    "SET LOCAL session_replication_role = replica;",
    ...sqlParts,
    "COMMIT;",
  ].join("\n");
  try {
    runSql(sql);
    console.log("✅ 完了");
  } catch (err) {
    console.error(`❌ 挿入失敗: ${err.message}`);
    process.exit(1);
  }
}

console.log("\n=== 完了 ===");
console.log("npm run dev でマップを確認してください。");
