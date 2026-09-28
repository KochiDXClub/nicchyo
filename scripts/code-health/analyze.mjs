// コードベースを読み、分類・行数・コピペ・ルール違反を集計する。
// 入力はファイルの一覧（{ path, content }）だけなので、作業ツリーでも過去のコミットでも同じように測れる。

import { createHash } from "node:crypto";
import { METRICS, ROLES, RULES, SHARED_ROLES } from "./rules.mjs";

export const TARGET_ROOTS = ["app/", "lib/", "components/", "utils/", "types/", "scripts/", "tests/"];
export const TARGET_ROOT_FILES = ["proxy.ts"];
const SOURCE_EXT = /\.(?:ts|tsx|js|jsx|mjs)$/;

// コピペ検出: 意味のある行を WINDOW 行ずつ見て、同じ並びが別の場所にもあれば重複とみなす
const WINDOW = 8;
const MIN_WINDOW_CHARS = 200;
const LARGE_FILE_LINES = 600;
const PAGE_FILE_NAMES = new Set([
  "page", "layout", "loading", "error", "not-found", "template", "default",
  "route", "sitemap", "robots", "opengraph-image", "global-error", "manifest",
]);

export function isTargetPath(path) {
  if (!SOURCE_EXT.test(path)) return false;
  if (path.includes("node_modules/") || path.startsWith(".")) return false;
  return TARGET_ROOTS.some((root) => path.startsWith(root)) || TARGET_ROOT_FILES.includes(path);
}

/** 種類: own（自作）/ test / generated（自動生成）/ data（定数・モック・デモ） */
export function classifyKind(path, content) {
  if (/\.(?:test|spec)\.[jt]sx?$/.test(path) || path.includes("__tests__/") || path.startsWith("tests/")) {
    return "test";
  }
  const head = content.slice(0, 600);
  if (/database\.types\.ts$/.test(path) || /@generated|auto-generated|DO NOT EDIT|自動生成/i.test(head)) {
    return "generated";
  }
  const base = path.split("/").pop();
  if (/(^|\/)(?:data|fixtures|mocks)\//.test(path) || /(?:sample|mock|fixture|demo)/i.test(base)) {
    return "data";
  }
  return "own";
}

/** 機能: rules.mjs の ROLES の id */
export function classifyRole(path, kind) {
  if (kind === "test") return "test";
  if (kind !== "own") return "other";
  if (path === "proxy.ts" || path.startsWith("app/api/")) return "api";
  if (path.startsWith("app/")) {
    const name = path.split("/").pop().replace(SOURCE_EXT, "");
    if (PAGE_FILE_NAMES.has(name)) return "page";
    return path.endsWith(".tsx") || path.endsWith(".jsx") ? "page-ui" : "page-logic";
  }
  if (path.startsWith("components/")) return "shared-ui";
  if (path.startsWith("lib/") || path.startsWith("utils/")) return "shared-logic";
  return "other";
}

/** ツリーマップのまとまり（機能領域）。ページ単位・lib のサブディレクトリ単位 */
export function areaOf(path) {
  const parts = path.split("/");
  const dirs = parts.slice(0, -1);
  if (dirs.length === 0) return "(root)";
  if (dirs[0] === "app") {
    if (dirs[1] === "api") return dirs.slice(0, 3).join("/");
    if (dirs[1]?.startsWith("(")) return dirs.slice(0, 3).join("/");
    return dirs.slice(0, 2).join("/");
  }
  if (["lib", "components", "utils", "types", "scripts", "tests"].includes(dirs[0])) {
    return dirs.slice(0, 2).join("/");
  }
  return dirs[0];
}

function countNonBlankLines(content) {
  let n = 0;
  for (const line of content.split("\n")) if (line.trim() !== "") n += 1;
  return n;
}

/** コピペ判定に使う「意味のある行」。コメント・import・閉じ括弧だけの行は捨てる */
export function significantLines(content) {
  const out = [];
  const lines = content.split("\n");
  let inBlockComment = false;
  for (let i = 0; i < lines.length; i += 1) {
    let text = lines[i].trim();
    if (inBlockComment) {
      if (text.includes("*/")) inBlockComment = false;
      continue;
    }
    if (text.startsWith("/*")) {
      if (!text.includes("*/")) inBlockComment = true;
      continue;
    }
    if (text.startsWith("//") || text.startsWith("*") || text.startsWith("{/*")) continue;
    if (/^import\s/.test(text) || /^\}\s*from\s+["']/.test(text) || /^export\s+\*\s+from/.test(text)) continue;
    if (/^["']use (?:client|server)["'];?$/.test(text)) continue;
    text = text.replace(/\s+/g, " ");
    if (/^[\])}>;,(]*$/.test(text) || text === "</>" || /^<\/[\w.]+>$/.test(text)) continue;
    out.push({ text, line: i + 1 });
  }
  return out;
}

function hashText(text) {
  return createHash("sha1").update(text).digest("base64url").slice(0, 16);
}

/**
 * コピペ検出。
 * 戻り値: ファイルごとの重複行数と、まとまりごとの一覧（長い順）
 */
export function detectClones(files) {
  const sig = new Map();
  const windows = new Map();
  for (const f of files) {
    const lines = significantLines(f.content);
    sig.set(f.path, lines);
    for (let i = 0; i + WINDOW <= lines.length; i += 1) {
      const slice = lines.slice(i, i + WINDOW);
      const joined = slice.map((l) => l.text).join("\n");
      if (joined.length < MIN_WINDOW_CHARS) continue;
      const key = hashText(joined);
      const list = windows.get(key);
      if (list) list.push({ path: f.path, index: i });
      else windows.set(key, [{ path: f.path, index: i }]);
    }
  }

  const covered = new Map();
  const runs = new Map();
  const mark = (path, index) => {
    let set = covered.get(path);
    if (!set) covered.set(path, (set = new Set()));
    for (let k = index; k < index + WINDOW; k += 1) set.add(k);
  };

  for (const occ of windows.values()) {
    if (occ.length < 2) continue;
    // 同じファイル内で重なっている窓（繰り返し構造の中の自己一致）は重複として数えない
    const distinct = [];
    for (const o of occ) {
      if (!distinct.some((d) => d.path === o.path && Math.abs(d.index - o.index) < WINDOW)) distinct.push(o);
    }
    if (distinct.length < 2) continue;
    for (const o of distinct) mark(o.path, o.index);
    // まとまりを作るため、先頭の出現と他の出現の組を記録する
    const [first, ...rest] = distinct;
    for (const other of rest) {
      const [a, b] = first.path <= other.path ? [first, other] : [other, first];
      const key = `${a.path}\u0000${b.path}\u0000${a.index - b.index}`;
      let list = runs.get(key);
      if (!list) runs.set(key, (list = []));
      list.push(a.index);
    }
  }

  const blocks = [];
  for (const [key, starts] of runs) {
    const [pathA, pathB, deltaText] = key.split("\u0000");
    const delta = Number(deltaText);
    const sorted = [...new Set(starts)].sort((x, y) => x - y);
    let runStart = sorted[0];
    let prev = sorted[0];
    const flush = () => {
      const endIndex = prev + WINDOW - 1;
      const la = sig.get(pathA);
      const lb = sig.get(pathB);
      blocks.push({
        a: { path: pathA, start: la[runStart].line, end: la[endIndex].line },
        b: { path: pathB, start: lb[runStart - delta].line, end: lb[endIndex - delta].line },
        lines: endIndex - runStart + 1,
      });
    };
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
        continue;
      }
      flush();
      runStart = sorted[i];
      prev = sorted[i];
    }
    flush();
  }
  blocks.sort((x, y) => y.lines - x.lines);

  const dupLinesByFile = new Map();
  let significantTotal = 0;
  for (const [path, lines] of sig) {
    significantTotal += lines.length;
    dupLinesByFile.set(path, covered.get(path)?.size ?? 0);
  }
  return { blocks, dupLinesByFile, significantTotal };
}

function applyRules(file) {
  const hits = {};
  for (const rule of RULES) {
    if (!rule.scope(file)) continue;
    const matches = file.content.match(rule.pattern);
    if (!matches || matches.length === 0) continue;
    const normalize = rule.normalize ?? ((m) => m.trim());
    hits[rule.id] = { count: matches.length, values: [...new Set(matches.map(normalize))] };
  }
  return hits;
}

function summarizeRule(rule, files) {
  const perFile = [];
  const unique = new Set();
  let matches = 0;
  for (const f of files) {
    const hit = f.ruleHits[rule.id];
    if (!hit) continue;
    matches += hit.count;
    hit.values.forEach((v) => unique.add(v));
    perFile.push({ path: f.path, count: hit.count });
  }
  perFile.sort((a, b) => b.count - a.count);
  const value = rule.countMode === "files" ? perFile.length : rule.countMode === "unique" ? unique.size : matches;
  return { value, matches, fileCount: perFile.length, files: perFile };
}

/** 同じ名前の部品が別々の場所にあるもの（app/ のページ専用UI と components/ が対象） */
export function findSameNameComponents(files) {
  const byName = new Map();
  for (const f of files) {
    if (f.kind !== "own" || !/\.tsx$/.test(f.path)) continue;
    if (f.role !== "page-ui" && f.role !== "shared-ui") continue;
    const name = f.path.split("/").pop().replace(/\.tsx$/, "");
    if (name === "index" || PAGE_FILE_NAMES.has(name)) continue;
    const list = byName.get(name) ?? [];
    list.push(f.path);
    byName.set(name, list);
  }
  const groups = [];
  for (const [name, paths] of byName) {
    const dirs = new Set(paths.map((p) => p.split("/").slice(0, -1).join("/")));
    if (dirs.size < 2) continue;
    groups.push({ name, paths: paths.sort() });
  }
  return groups.sort((a, b) => b.paths.length - a.paths.length || a.name.localeCompare(b.name));
}

/**
 * @param {{ path: string, content: string }[]} inputFiles
 * @param {{ label?: string }} options
 */
export function analyze(inputFiles, options = {}) {
  const files = inputFiles
    .filter((f) => isTargetPath(f.path))
    .map((f) => {
      const kind = classifyKind(f.path, f.content);
      const role = classifyRole(f.path, kind);
      const file = {
        path: f.path,
        content: f.content,
        kind,
        role,
        area: areaOf(f.path),
        lines: countNonBlankLines(f.content),
        hash: hashText(f.content),
      };
      file.ruleHits = applyRules(file);
      return file;
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const productFiles = files.filter((f) => f.kind === "own" && f.role !== "other");
  const clones = detectClones(productFiles);
  for (const f of files) f.dupLines = clones.dupLinesByFile.get(f.path) ?? 0;

  const byKind = {};
  const byRole = {};
  for (const f of files) {
    byKind[f.kind] = byKind[f.kind] ?? { files: 0, lines: 0 };
    byKind[f.kind].files += 1;
    byKind[f.kind].lines += f.lines;
    byRole[f.role] = byRole[f.role] ?? { files: 0, lines: 0 };
    byRole[f.role].files += 1;
    byRole[f.role].lines += f.lines;
  }

  const productLines = productFiles.reduce((s, f) => s + f.lines, 0);
  const sharedLines = productFiles.filter((f) => SHARED_ROLES.has(f.role)).reduce((s, f) => s + f.lines, 0);
  const dupTotal = productFiles.reduce((s, f) => s + f.dupLines, 0);
  const largeFiles = files
    .filter((f) => f.kind === "own" && f.lines > LARGE_FILE_LINES)
    .map((f) => ({ path: f.path, lines: f.lines, role: f.role }))
    .sort((a, b) => b.lines - a.lines);
  const sameName = findSameNameComponents(files);

  const metricValues = {
    sharedRatio: productLines === 0 ? 0 : round1((sharedLines / productLines) * 100),
    duplicationRatio: clones.significantTotal === 0 ? 0 : round1((dupTotal / clones.significantTotal) * 100),
    largeFiles: largeFiles.length,
    sameNameComponents: sameName.length,
  };

  /** @type {Record<string, ReturnType<typeof summarizeRule>>} */
  const rules = {};
  for (const rule of RULES) rules[rule.id] = summarizeRule(rule, files);

  return {
    label: options.label ?? "working tree",
    generatedAt: new Date().toISOString(),
    totals: {
      files: files.length,
      lines: files.reduce((s, f) => s + f.lines, 0),
      productLines,
      sharedLines,
      duplicatedLines: dupTotal,
      significantLines: clones.significantTotal,
      byKind,
      byRole,
    },
    metrics: Object.fromEntries(METRICS.map((m) => [m.id, metricValues[m.id]])),
    rules,
    clones: clones.blocks,
    sameName,
    largeFiles,
    files: files.map(({ content: _content, ...rest }) => rest),
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

export { ROLES, RULES, METRICS };
