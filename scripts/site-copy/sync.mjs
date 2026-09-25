// スプレッドシートで編集した文言を content/site-copy/*.json に取り込む（docs/SITE_COPY.md）。
//
//   SITE_COPY_SHEET_ID=<シートID> node scripts/site-copy/sync.mjs
//   node scripts/site-copy/sync.mjs --export <dir>   # 今の JSON をシート貼り付け用の CSV に書き出す
//
// 検証に1件でも引っかかったら何も書き込まずに終了コード 1 で終わる。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.resolve(__dirname, "..", "..", "content", "site-copy");

/** app/(public)/faq/data.ts の FaqCategory と揃える（sync.test.ts で一致を確かめている） */
export const FAQ_CATEGORIES = ["map", "favorites", "account", "general"];

// シートの見出し。列の並び順は自由で、見出しの文字で列を探す
const TEXT_COLUMNS = { key: "key", text: "文言", max: "最大文字数" };
const FAQ_COLUMNS = { id: "id", category: "カテゴリ", q: "質問", a: "回答" };

const KEY_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;
// 文言は React がそのまま文字として出すので害はないが、タグを書いても効かないので誤りとして止める
const HTML_TAG_PATTERN = /<\/?[a-zA-Z][^>]*>/;

/**
 * RFC 4180 の CSV を2次元配列にする。セル内の改行・カンマ・"" のエスケープに対応する。
 * @param {string} csv
 * @returns {string[][]}
 */
export function parseCsv(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const text = csv.replace(/^﻿/, "");

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** @param {string[][]} rows 先頭行が見出し。空行は飛ばす */
function toRecords(rows, columns) {
  const [header = [], ...body] = rows;
  const index = {};
  for (const [field, label] of Object.entries(columns)) {
    index[field] = header.findIndex((h) => h.trim() === label);
  }
  const records = [];
  body.forEach((cells, i) => {
    if (cells.every((c) => c.trim() === "")) return;
    const record = { row: i + 2 };
    for (const field of Object.keys(columns)) {
      record[field] = index[field] >= 0 ? (cells[index[field]] ?? "").trim() : "";
    }
    records.push(record);
  });
  return records;
}

function requireColumns(rows, columns, required, sheetName, errors) {
  const header = (rows[0] ?? []).map((h) => h.trim());
  for (const field of required) {
    if (!header.includes(columns[field])) {
      errors.push(`シート「${sheetName}」に見出し「${columns[field]}」の列がありません`);
    }
  }
}

function checkText(value, where, errors) {
  if (value === "") errors.push(`${where}: 空欄です`);
  if (HTML_TAG_PATTERN.test(value)) errors.push(`${where}: HTML のタグは使えません`);
}

/**
 * 「文言」シートを texts.json の中身にする。
 * コードが使っているキー（currentKeys）がシートから消えていたら止める。キーの削除はコード側の変更と一緒に行う。
 * @returns {{ texts: Record<string, string>, errors: string[] }}
 */
export function buildTexts(rows, currentKeys = []) {
  const errors = [];
  const sheet = "文言";
  requireColumns(rows, TEXT_COLUMNS, ["key", "text"], sheet, errors);
  if (errors.length > 0) return { texts: {}, errors };

  const texts = {};
  for (const r of toRecords(rows, TEXT_COLUMNS)) {
    const where = `「${sheet}」${r.row}行目（${r.key || "key なし"}）`;
    if (!KEY_PATTERN.test(r.key)) {
      errors.push(`${where}: key は「faq.title」のような 英数字.英数字 の形にしてください`);
      continue;
    }
    if (r.key in texts) {
      errors.push(`${where}: key が重複しています`);
      continue;
    }
    checkText(r.text, where, errors);
    if (r.max !== "") {
      const max = Number(r.max);
      if (!Number.isInteger(max) || max <= 0) {
        errors.push(`${where}: 最大文字数は正の整数で書いてください`);
      } else if ([...r.text].length > max) {
        errors.push(`${where}: ${[...r.text].length}文字あり、最大文字数 ${max} を超えています`);
      }
    }
    texts[r.key] = r.text;
  }
  for (const key of currentKeys) {
    if (!(key in texts)) {
      errors.push(`「${sheet}」: key「${key}」がシートにありません（サイトで使っているので消せません）`);
    }
  }
  return { texts, errors };
}

/**
 * 「FAQ」シートを faq.json の中身にする。並び順はシートの行順。
 * @returns {{ faq: { id: string, category: string, q: string, a: string }[], errors: string[] }}
 */
export function buildFaq(rows) {
  const errors = [];
  const sheet = "FAQ";
  requireColumns(rows, FAQ_COLUMNS, ["id", "category", "q", "a"], sheet, errors);
  if (errors.length > 0) return { faq: [], errors };

  const faq = [];
  const seen = new Set();
  for (const r of toRecords(rows, FAQ_COLUMNS)) {
    const where = `「${sheet}」${r.row}行目（${r.id || "id なし"}）`;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) {
      errors.push(`${where}: id は「map-free」のような 小文字英数字とハイフン にしてください`);
      continue;
    }
    if (seen.has(r.id)) {
      errors.push(`${where}: id が重複しています`);
      continue;
    }
    seen.add(r.id);
    if (!FAQ_CATEGORIES.includes(r.category)) {
      errors.push(`${where}: カテゴリは ${FAQ_CATEGORIES.join(" / ")} のどれかにしてください`);
    }
    checkText(r.q, `${where} 質問`, errors);
    checkText(r.a, `${where} 回答`, errors);
    faq.push({ id: r.id, category: r.category, q: r.q, a: r.a });
  }
  if (faq.length === 0 && errors.length === 0) errors.push(`「${sheet}」: 質問が1件もありません`);
  return { faq, errors };
}

/** 「リンクを知っている全員が閲覧可」のシートを、シート名を指定して CSV で取る */
async function fetchSheet(sheetId, sheetName) {
  const url =
    `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq` +
    `?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const body = await res.text();
  // 共有されていないとログイン画面の HTML が 200 で返ってくる
  if (!res.ok || body.trimStart().startsWith("<")) {
    throw new Error(
      `シート「${sheetName}」を読めませんでした（HTTP ${res.status}）。` +
        "シート名と、共有設定が「リンクを知っている全員が閲覧可」になっているかを確かめてください",
    );
  }
  return parseCsv(body);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), "utf-8"));
}

/** 中身が変わったときだけ書く（差分がなければ PR も作られない） */
function writeJson(file, data) {
  const filePath = path.join(CONTENT_DIR, file);
  const next = JSON.stringify(data, null, 2) + "\n";
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, "utf-8") === next) return false;
  fs.writeFileSync(filePath, next, "utf-8");
  return true;
}

function toCsv(rows) {
  const escape = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rows.map((r) => r.map((v) => escape(String(v))).join(",")).join("\r\n") + "\r\n";
}

export function exportCsv(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const texts = readJson("texts.json");
  const faq = readJson("faq.json");
  fs.writeFileSync(
    path.join(dir, "文言.csv"),
    toCsv([
      [TEXT_COLUMNS.key, TEXT_COLUMNS.text, TEXT_COLUMNS.max, "備考"],
      ...Object.entries(texts).map(([k, v]) => [k, v, "", ""]),
    ]),
  );
  fs.writeFileSync(
    path.join(dir, "FAQ.csv"),
    toCsv([
      [FAQ_COLUMNS.id, FAQ_COLUMNS.category, FAQ_COLUMNS.q, FAQ_COLUMNS.a],
      ...faq.map((f) => [f.id, f.category, f.q, f.a]),
    ]),
  );
  console.log(`${dir} に 文言.csv と FAQ.csv を書き出しました`);
}

async function main() {
  const args = process.argv.slice(2);
  const exportAt = args.indexOf("--export");
  if (exportAt >= 0) {
    exportCsv(path.resolve(args[exportAt + 1] ?? "site-copy-export"));
    return;
  }

  const sheetId = process.env.SITE_COPY_SHEET_ID;
  if (!sheetId) {
    console.error("環境変数 SITE_COPY_SHEET_ID にシートの ID を入れてください");
    process.exitCode = 1;
    return;
  }

  const [textRows, faqRows] = await Promise.all([
    fetchSheet(sheetId, "文言"),
    fetchSheet(sheetId, "FAQ"),
  ]);
  const { texts, errors: textErrors } = buildTexts(textRows, Object.keys(readJson("texts.json")));
  const { faq, errors: faqErrors } = buildFaq(faqRows);
  const errors = [...textErrors, ...faqErrors];

  if (errors.length > 0) {
    console.error(`シートに直すところが ${errors.length} 件あります。何も取り込んでいません。`);
    for (const e of errors) console.error(`- ${e}`);
    process.exitCode = 1;
    return;
  }

  const changed = [writeJson("texts.json", texts) && "texts.json", writeJson("faq.json", faq) && "faq.json"].filter(Boolean);
  console.log(changed.length > 0 ? `更新: ${changed.join(", ")}` : "変更はありません");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // process.exit() だと、もう一方のシートの取得が残っているときに Windows の Node が異常終了する
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
}
