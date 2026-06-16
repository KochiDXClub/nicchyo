/**
 * 本番Supabaseからデータを取得してローカルDBに流し込むスクリプト。
 * supabase db dump がポート5432ブロックで使えない場合の代替手段。
 *
 * 使い方: node scripts/seed-local.mjs
 * 前提: npx supabase start でローカルSupabaseが起動済みであること
 */

import { createClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const PROD_URL = "https://dbaufykimgzfgoeyyxwz.supabase.co";
const PROD_KEY = "sb_publishable_YmiwaMlYH1K-CnfmVZI3FA_0TmOcsTu";

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
  // Node 22+ はネイティブ WebSocket があるため ws 不要
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
      `docker exec -i ${DOCKER_CONTAINER} psql -U postgres -d postgres < ${tmpFile}`,
      { stdio: "pipe" }
    );
  } finally {
    unlinkSync(tmpFile);
  }
}

async function seedTable(table) {
  process.stdout.write(`${table} を取得中... `);
  const { data, error } = await prod.from(table).select("*");
  if (error) {
    console.error(`❌ 取得失敗: ${error.message}`);
    return;
  }
  if (!data?.length) {
    console.log("データなし、スキップ");
    return;
  }
  console.log(`${data.length} 件取得`);

  process.stdout.write(`${table} をローカルに挿入中... `);
  try {
    // session_replication_role = replica で外部キーチェックを無効化
    const sql = [
      "SET session_replication_role = replica;",
      rowsToInsertSql(table, data),
      "SET session_replication_role = DEFAULT;",
    ].join("\n");
    runSql(sql);
    console.log("✅ 完了");
  } catch (err) {
    console.error(`❌ 挿入失敗: ${err.message}`);
  }
}

console.log("=== ローカルDBシード開始 ===\n");
for (const table of TABLES) {
  await seedTable(table);
}
console.log("\n=== 完了 ===");
console.log("npm run dev でマップを確認してください。");
