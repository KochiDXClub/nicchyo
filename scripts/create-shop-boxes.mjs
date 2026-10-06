/**
 * 店舗の「箱」だけを作る（ログインアカウントは作らない）。
 *
 * 運営が、店名・カテゴリなどの情報を持った店舗を先に用意し、出店者があとから QR コードで
 * Google アカウントを紐づける（docs/VENDOR_ACCOUNTS.md）。そのための店舗の行を作る。
 * 旧来の scripts/create-vendors-from-shops.js は、店ごとにメール・パスワードのアカウントも作る方式で、
 * 新しい運用では使わない。
 *
 * 使い方:
 *   node scripts/create-shop-boxes.mjs --dry-run     # 何が作られるかだけを見る（DB には触らない）
 *   node scripts/create-shop-boxes.mjs               # 作る
 *   node scripts/create-shop-boxes.mjs --csv path/to/shops.csv
 *
 * 入力: data/shopsmanage/shops_rows.csv（id, name, category, shop_strength, stall_style 列を使う）と
 *       data/shopsmanage/categories.csv（カテゴリ名 → id）。
 * - 店舗の ID は、CSV の id 列をそのまま使う（何度実行しても同じ店舗になる）。
 * - すでにある店舗は上書きしない（出店者が編集した内容を壊さないため）。新しい店舗だけを足す。
 * - 店舗の位置は、この処理の対象外（マップ編集・配置の画面で登録する）。
 * - 必要な環境変数: NEXT_PUBLIC_SUPABASE_URL（または SUPABASE_URL）と SUPABASE_SERVICE_ROLE_KEY（.env.local に書く）。
 *   **本番に向けて実行するときは、向き先の URL を確かめてから**。
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const BASE_DIR = process.cwd();
const DATA_DIR = path.resolve(BASE_DIR, "data", "shopsmanage");
const ENV_PATHS = [path.resolve(BASE_DIR, ".env.local"), path.resolve(BASE_DIR, ".env")];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function loadEnv() {
  for (const envPath of ENV_PATHS) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      if (!process.env[key]) process.env[key] = trimmed.slice(idx + 1).trim().replace(/^"(.*)"$/, "$1");
    }
    return envPath;
  }
  return null;
}

export function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current);
  return result.map((value) => value.trim());
}

function loadCsvRows(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`CSV not found: ${filePath}`);
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row = {};
    header.forEach((key, index) => {
      row[key] = cols[index] ?? "";
    });
    return row;
  });
}

/** CSV の 1 行を、vendors に入れる行へ。入れられない行は理由つきで null */
export function toVendorRow(row, categoryMap) {
  const id = (row.id || "").trim();
  const name = (row.name || "").trim();
  if (!UUID_RE.test(id)) return { skip: `id が uuid ではありません: ${id || "(空)"}` };
  if (!name) return { skip: `店名が空です: ${id}` };
  const categoryName = (row.category || "").trim();
  return {
    row: {
      id,
      shop_name: name,
      strength: (row.shop_strength || "").trim() || null,
      style: (row.stall_style || "").trim() || null,
      category_id: categoryMap.get(categoryName) || null,
      role: "vendor",
      // 出店者はログインせずに紐づくので、「最初のパスワード変更」は要らない
      must_change_password: false,
    },
    unknownCategory: categoryName && !categoryMap.get(categoryName) ? categoryName : null,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const csvIndex = args.indexOf("--csv");
  const shopsCsv = csvIndex !== -1 ? path.resolve(BASE_DIR, args[csvIndex + 1]) : path.join(DATA_DIR, "shops_rows.csv");

  const envLoaded = loadEnv();
  if (envLoaded) console.log(`Loaded env from ${envLoaded}`);

  const categoryMap = new Map();
  for (const row of loadCsvRows(path.join(DATA_DIR, "categories.csv"))) {
    const name = (row.name || "").trim();
    if (name && row.id) categoryMap.set(name, row.id);
  }

  const rows = [];
  const seen = new Set();
  const unknownCategories = new Set();
  let skipped = 0;
  for (const csvRow of loadCsvRows(shopsCsv)) {
    const result = toVendorRow(csvRow, categoryMap);
    if (result.skip) {
      console.warn(`Skip: ${result.skip}`);
      skipped += 1;
      continue;
    }
    if (seen.has(result.row.id)) {
      console.warn(`Skip: id が重複しています: ${result.row.id}`);
      skipped += 1;
      continue;
    }
    seen.add(result.row.id);
    if (result.unknownCategory) unknownCategories.add(result.unknownCategory);
    rows.push(result.row);
  }

  console.log(`対象の店舗: ${rows.length}（飛ばした行: ${skipped}）`);
  if (unknownCategories.size > 0) {
    console.warn(`categories.csv に無いカテゴリ（未分類として作ります）: ${[...unknownCategories].join("、")}`);
  }

  if (dryRun) {
    console.log("--dry-run: DB には触りません。先頭の 5 件:");
    rows.slice(0, 5).forEach((row) => console.log(`  ${row.id}  ${row.shop_name}`));
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is missing.");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing.");
  console.log(`向き先: ${supabaseUrl}`);

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // すでにある店舗は上書きしない（ignoreDuplicates）。100 件ずつ送る
  let created = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await supabase
      .from("vendors")
      .upsert(chunk, { onConflict: "id", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(`vendors upsert error: ${error.message}`);
    created += data?.length ?? 0;
  }
  console.log(`作った店舗: ${created}（すでにあった店舗: ${rows.length - created}）`);
}

// 直接実行したときだけ動かす（テストから import されたときは動かさない）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
