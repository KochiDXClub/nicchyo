#!/usr/bin/env node
// コード健康診断
//
//   npm run code-health                 今のコードを測って .code-health/report.html を作る
//   npm run code-health:diff            develop との分岐点と比べる（悪化があれば終了コード 1）
//
// オプション:
//   --base <ref>          比較相手（ref と HEAD の分岐点を before にする）
//   --strict              悪化があれば終了コード 1
//   --out <dir>           出力先（既定 .code-health）
//   --summary-file <path> Markdown の結果を追記する（CI の $GITHUB_STEP_SUMMARY 用）

import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyze, isTargetPath } from "./analyze.mjs";
import { diffReports, diffToMarkdown } from "./diff.mjs";
import { renderHtml } from "./report-html.mjs";
import { METRICS, RULES } from "./rules.mjs";

function parseArgs(argv) {
  const args = { base: null, strict: false, out: ".code-health", summaryFile: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--base") args.base = argv[++i];
    else if (a === "--strict") args.strict = true;
    else if (a === "--out") args.out = argv[++i];
    else if (a === "--summary-file") args.summaryFile = argv[++i];
    else throw new Error(`不明なオプション: ${a}`);
  }
  return args;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).trim();
}

function readWorkingTree() {
  const listed = git(["ls-files", "--cached", "--others", "--exclude-standard"]).split("\n");
  return listed
    .filter((p) => p && isTargetPath(p) && existsSync(p))
    .map((path) => ({ path, content: readFileSync(path, "utf8") }));
}

/** コミット時点のファイルを git から直接読む（作業ツリーには触れない） */
function readCommit(sha) {
  const paths = git(["ls-tree", "-r", "--name-only", sha]).split("\n").filter((p) => p && isTargetPath(p));
  const input = paths.map((p) => `${sha}:${p}`).join("\n") + "\n";
  const result = spawnSync("git", ["cat-file", "--batch"], { input, maxBuffer: 512 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr.toString());
  const buf = result.stdout;
  const files = [];
  let offset = 0;
  for (const path of paths) {
    const headerEnd = buf.indexOf(0x0a, offset);
    const header = buf.subarray(offset, headerEnd).toString();
    const size = Number(header.split(" ")[2]);
    const start = headerEnd + 1;
    files.push({ path, content: buf.subarray(start, start + size).toString("utf8") });
    offset = start + size + 1;
  }
  return files;
}

function shortSummary(report) {
  const lines = [`コード健康診断: ${report.totals.files}ファイル / ${report.totals.lines.toLocaleString()}行`];
  for (const m of METRICS) {
    const v = report.metrics[m.id];
    const ok = m.better === "lower" ? v <= m.target : v >= m.target;
    lines.push(`  ${ok ? "✓" : "✗"} ${m.label}: ${v}${m.unit === "%" ? "%" : m.unit}（目標 ${m.better === "lower" ? "≤" : "≥"} ${m.target}${m.unit === "%" ? "%" : m.unit}）`);
  }
  for (const r of RULES) {
    const v = report.rules[r.id].value;
    if (v > 0) lines.push(`  · ${r.label}: ${v}`);
  }
  return lines.join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = git(["rev-parse", "--show-toplevel"]);
  process.chdir(root);

  const after = analyze(readWorkingTree(), { label: `作業ツリー（${git(["rev-parse", "--abbrev-ref", "HEAD"])}）` });

  let diff = null;
  if (args.base) {
    let baseSha;
    try {
      baseSha = git(["merge-base", args.base, "HEAD"]);
    } catch {
      console.error(`比較相手 ${args.base} が見つかりません。先に git fetch origin develop を実行してください。`);
      process.exit(2);
    }
    const before = analyze(readCommit(baseSha), { label: `${args.base} との分岐点（${baseSha.slice(0, 7)}）` });
    diff = diffReports(before, after);
  }

  const outDir = resolve(args.out);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "report.json"), JSON.stringify(after, null, 2));
  writeFileSync(join(outDir, "report.html"), renderHtml(after, diff));

  if (diff) {
    const md = diffToMarkdown(diff);
    writeFileSync(join(outDir, "diff.md"), md + "\n");
    writeFileSync(join(outDir, "diff.json"), JSON.stringify(diff, null, 2));
    if (args.summaryFile) appendFileSync(args.summaryFile, md + "\n");
    console.log(md);
  } else {
    console.log(shortSummary(after));
  }
  console.log(`\nレポート: ${join(args.out, "report.html")}`);

  if (args.strict && diff?.failed) process.exit(1);
}

main();
