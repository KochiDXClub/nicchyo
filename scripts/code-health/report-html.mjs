// 集計結果を1枚の HTML レポートにする（外部ファイル・ライブラリなしで開ける）。

import { METRICS, ROLES, RULES } from "./rules.mjs";

const MAX_CLONES = 40;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function statusOf(metric, value) {
  const ok = metric.better === "lower" ? value <= metric.target : value >= metric.target;
  if (ok) return { cls: "good", label: "目標内" };
  const ratio = metric.better === "lower" ? value / Math.max(metric.target, 1) : value / Math.max(metric.target, 1);
  const far = metric.better === "lower" ? ratio > 2 : ratio < 0.5;
  return far ? { cls: "critical", label: "要改善" } : { cls: "warning", label: "もう少し" };
}

function unitText(value, unit) {
  return unit === "%" ? `${value}%` : `${value}${unit}`;
}

function metricCards(report, diff) {
  return METRICS.map((m) => {
    const v = report.metrics[m.id];
    const st = statusOf(m, v);
    const d = diff?.metrics.find((x) => x.id === m.id);
    const delta =
      d && d.change !== "same"
        ? `<span class="delta ${d.change}">${d.change === "better" ? "改善" : "悪化"}（${unitText(d.before, m.unit)} → ${unitText(d.after, m.unit)}）</span>`
        : "";
    return `<article class="tile">
      <h3>${escapeHtml(m.label)}</h3>
      <p class="value">${escapeHtml(unitText(v, m.unit))}</p>
      <p class="target">目標 ${m.better === "lower" ? "≤" : "≥"} ${escapeHtml(unitText(m.target, m.unit))}
        <span class="status ${st.cls}"><span aria-hidden="true">${st.cls === "good" ? "●" : st.cls === "warning" ? "▲" : "■"}</span>${st.label}</span></p>
      ${delta}
      <p class="why">${escapeHtml(m.why)}</p>
    </article>`;
  }).join("");
}

function compositionBar(report) {
  const roles = ROLES.filter((r) => !["test", "other"].includes(r.id));
  const total = roles.reduce((s, r) => s + (report.totals.byRole[r.id]?.lines ?? 0), 0) || 1;
  const segs = roles
    .map((r) => {
      const lines = report.totals.byRole[r.id]?.lines ?? 0;
      const pct = (lines / total) * 100;
      return `<div class="seg" style="width:${pct}%;background:var(--role-${r.id})" data-tip="${escapeHtml(`${r.label}: ${lines.toLocaleString()}行（${pct.toFixed(1)}%）`)}"></div>`;
    })
    .join("");
  const sharedTarget = METRICS.find((m) => m.id === "sharedRatio").target;
  const legend = roles
    .map((r) => {
      const lines = report.totals.byRole[r.id]?.lines ?? 0;
      return `<li><span class="sw" style="background:var(--role-${r.id})"></span>${escapeHtml(r.label)} <b>${((lines / total) * 100).toFixed(1)}%</b></li>`;
    })
    .join("");
  return `<div class="compo">
    <div class="compo-bar">${segs}<div class="compo-target" style="left:${100 - sharedTarget}%"><span>共通化の目標ライン（右側 ${sharedTarget}%）</span></div></div>
    <ul class="legend static">${legend}</ul>
  </div>`;
}

function ruleTable(report, diff) {
  const rows = RULES.map((r) => {
    const s = report.rules[r.id];
    const d = diff?.rules.find((x) => x.id === r.id);
    const change = d && d.change !== "same" ? `<span class="delta ${d.change}">${d.before} → ${d.after}</span>` : "";
    const top = s.files
      .slice(0, 8)
      .map((f) => `<li><code>${escapeHtml(f.path)}</code> ${f.count}</li>`)
      .join("");
    const unit = r.countMode === "files" ? "ファイル" : r.countMode === "unique" ? "種類" : "箇所";
    return `<tr>
      <th scope="row">${escapeHtml(r.label)}<div class="src">${escapeHtml(r.source)}</div></th>
      <td class="num">${s.value.toLocaleString()} <small>${unit}</small> ${change}</td>
      <td>${s.value === 0 ? '<span class="status good"><span aria-hidden="true">●</span>0</span>' : `<details><summary>${escapeHtml(r.why)}</summary><ul class="files">${top}</ul></details>`}</td>
    </tr>`;
  }).join("");
  return `<div class="table-wrap"><table class="rules"><thead><tr><th>ルール</th><th class="num">現状</th><th>理由・多いファイル</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function cloneTable(report) {
  if (report.clones.length === 0) return "<p>8行以上のコピペは見つかりませんでした。</p>";
  const rows = report.clones
    .slice(0, MAX_CLONES)
    .map(
      (c) => `<tr><td class="num">${c.lines}</td>
      <td><code>${escapeHtml(c.a.path)}</code> <small>L${c.a.start}-${c.a.end}</small></td>
      <td><code>${escapeHtml(c.b.path)}</code> <small>L${c.b.start}-${c.b.end}</small></td></tr>`
    )
    .join("");
  return `<div class="table-wrap"><table><thead><tr><th class="num">行</th><th>場所 A</th><th>場所 B</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function listSection(report) {
  const large = report.largeFiles
    .map((f) => `<li><code>${escapeHtml(f.path)}</code> <b>${f.lines.toLocaleString()}</b>行</li>`)
    .join("");
  const same = report.sameName.length
    ? report.sameName.map((g) => `<li><b>${escapeHtml(g.name)}</b>: ${g.paths.map((p) => `<code>${escapeHtml(p)}</code>`).join(" / ")}</li>`).join("")
    : "<li>ありません</li>";
  return `<div class="two">
    <div><h3>巨大ファイル（600行超）</h3><ol class="files">${large || "<li>ありません</li>"}</ol></div>
    <div><h3>同じ名前の部品が別の場所にある</h3><ul class="files">${same}</ul></div>
  </div>`;
}

function diffSection(diff) {
  if (!diff) return "";
  // 変化した行だけを出す（全部同じなら表そのものを省く）
  const changed = [...diff.metrics, ...diff.rules].filter((m) => m.change !== "same");
  const rows = changed
    .map((m) => {
      const cls = m.change === "better" ? "better" : m.change === "worse" ? "worse" : "";
      const text = m.change === "better" ? "改善" : m.change === "worse" ? "悪化" : "変化なし";
      return `<tr><th scope="row">${escapeHtml(m.label)}</th><td class="num">${escapeHtml(unitText(m.before, m.unit ?? ""))}</td><td class="num">${escapeHtml(unitText(m.after, m.unit ?? ""))}</td><td><span class="delta ${cls}">${text}</span></td></tr>`;
    })
    .join("");
  const regress = [
    ...diff.ruleRegressions.map(
      (r) => `<li><code>${escapeHtml(r.path)}</code> ${escapeHtml(r.label)}: ${r.before} → ${r.after}${r.newValues.length ? `（${r.newValues.map((v) => `<code>${escapeHtml(v)}</code>`).join(", ")}）` : ""}</li>`
    ),
    ...diff.duplicationRegressions.map(
      (d) => `<li><code>${escapeHtml(d.path)}</code> コピペ行: ${d.before} → ${d.after}${d.partners.length ? `（相手: ${d.partners.map((p) => `<code>${escapeHtml(p.other.path)}</code> L${p.other.start}`).join(", ")}）` : ""}</li>`
    ),
  ].join("");
  return `<section>
    <h2>ビフォーアフター <small>${escapeHtml(diff.before.label)} → ${escapeHtml(diff.after.label)}</small></h2>
    <p class="lead ${diff.failed ? "bad" : "ok"}">${diff.failed ? "⚠️ 共通化・デザインのルールに対して悪化があります" : "✅ 悪化はありません"}（変更ファイル ${diff.changedFiles.length} 件、コピペ行 ${diff.dupDelta >= 0 ? "+" : ""}${diff.dupDelta}）</p>
    ${rows ? `<div class="table-wrap"><table><thead><tr><th>指標</th><th class="num">before</th><th class="num">after</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="meta">指標・ルールの数値に変化はありません。</p>'}
    ${regress ? `<h3>悪化した箇所</h3><ul class="files">${regress}</ul>` : ""}
  </section>`;
}

function roleVars(dark) {
  return ROLES.map((r) => `--role-${r.id}: ${dark ? r.darkColor : r.color};`).join("\n");
}

export function renderHtml(report, diff = null) {
  const data = {
    roles: ROLES.map(({ id, label }) => ({ id, label })),
    rules: RULES.map(({ id, label }) => ({ id, label })),
    files: report.files.map((f) => ({
      p: f.path,
      a: f.area,
      l: f.lines,
      r: f.role,
      k: f.kind,
      d: f.dupLines,
      h: Object.fromEntries(Object.entries(f.ruleHits).map(([k, v]) => [k, v.count])),
    })),
  };
  const t = report.totals;
  const kindLabel = { own: "自作", test: "テスト", generated: "自動生成", data: "データ・デモ" };
  const kinds = Object.entries(t.byKind)
    .map(([k, v]) => `<li>${kindLabel[k] ?? k} <b>${v.lines.toLocaleString()}</b>行（${v.files}ファイル）</li>`)
    .join("");

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>コード健康診断</title>
<style>
:root {
  color-scheme: light;
  --page: #f9f9f7; --surface: #fcfcfb; --ink: #0b0b0b; --ink-2: #52514e; --muted: #898781;
  --grid: #e1e0d9; --ring: rgba(11,11,11,0.10);
  --good: #0ca30c; --warning: #fab219; --serious: #ec835a; --critical: #d03b3b; --good-text: #006300;
  --seq-0: #f0efec; --seq-1: #cde2fb; --seq-2: #9ec5f4; --seq-3: #6da7ec; --seq-4: #3987e5; --seq-5: #256abf; --seq-6: #104281;
  ${roleVars(false)}
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
    --grid: #2c2c2a; --ring: rgba(255,255,255,0.10); --good-text: #0ca30c;
    --seq-0: #2c2c2a; --seq-1: #104281; --seq-2: #184f95; --seq-3: #256abf; --seq-4: #3987e5; --seq-5: #6da7ec; --seq-6: #b7d3f6;
    ${roleVars(true)}
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --page: #0d0d0d; --surface: #1a1a19; --ink: #ffffff; --ink-2: #c3c2b7; --muted: #898781;
  --grid: #2c2c2a; --ring: rgba(255,255,255,0.10); --good-text: #0ca30c;
  --seq-0: #2c2c2a; --seq-1: #104281; --seq-2: #184f95; --seq-3: #256abf; --seq-4: #3987e5; --seq-5: #6da7ec; --seq-6: #b7d3f6;
  ${roleVars(true)}
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--page); color: var(--ink); font: 15px/1.6 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", sans-serif; }
main { max-width: 1160px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 26px; margin: 0 0 4px; }
h2 { font-size: 19px; margin: 0 0 12px; }
h2 small, .meta { color: var(--ink-2); font-weight: normal; font-size: 13px; }
h3 { font-size: 15px; margin: 0 0 8px; }
section { background: var(--surface); border-radius: 16px; box-shadow: 0 0 0 1px var(--ring); padding: 20px; margin-top: 20px; }
.kinds { display: flex; flex-wrap: wrap; gap: 4px 20px; padding: 0; margin: 8px 0 0; list-style: none; color: var(--ink-2); font-size: 13px; }
.tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.tile { border-radius: 12px; box-shadow: 0 0 0 1px var(--ring); padding: 14px; }
.tile h3 { color: var(--ink-2); font-weight: 600; font-size: 13px; margin: 0; }
.tile .value { font-size: 32px; font-weight: 700; margin: 2px 0; }
.tile .target { margin: 0; font-size: 13px; color: var(--ink-2); display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.tile .why { font-size: 12px; color: var(--muted); margin: 8px 0 0; }
.status { display: inline-flex; gap: 4px; align-items: center; font-size: 12px; font-weight: 600; color: var(--ink); }
.status span { font-size: 10px; }
.status.good span { color: var(--good); } .status.warning span { color: var(--warning); } .status.critical span { color: var(--critical); }
.delta { font-size: 12px; font-weight: 600; }
.delta.better { color: var(--good-text); } .delta.worse { color: var(--critical); }
.compo-bar { position: relative; display: flex; gap: 2px; height: 28px; border-radius: 6px; overflow: visible; margin: 28px 0 8px; }
.compo-bar .seg { height: 100%; border-radius: 4px; min-width: 2px; }
.compo-target { position: absolute; top: -22px; bottom: -4px; border-left: 2px dashed var(--ink); }
.compo-target span { position: absolute; top: 0; right: 6px; white-space: nowrap; font-size: 12px; color: var(--ink-2); }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 0; margin: 8px 0 0; list-style: none; font-size: 13px; color: var(--ink-2); }
.legend .sw { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
.legend button { font: inherit; color: inherit; background: none; border: 0; padding: 4px 6px; border-radius: 6px; cursor: pointer; }
.legend button[aria-pressed="true"] { background: var(--grid); color: var(--ink); }
.controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 13px; }
.controls button { font: inherit; border: 0; border-radius: 999px; padding: 6px 12px; background: var(--grid); color: var(--ink); cursor: pointer; }
.controls button[aria-pressed="true"] { background: var(--ink); color: var(--surface); }
#treemap { position: relative; width: 100%; height: 620px; border-radius: 8px; overflow: hidden; background: var(--surface); }
#treemap .area { position: absolute; box-shadow: inset 0 0 0 1px var(--surface); }
#treemap .area-label { position: absolute; left: 4px; top: 1px; right: 4px; font-size: 11px; font-weight: 700; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; }
#treemap .tile-file { position: absolute; border: 1px solid var(--surface); border-radius: 2px; }
#treemap .tile-file.dim { opacity: 0.18; }
#treemap .tile-file:hover { outline: 2px solid var(--ink); z-index: 2; }
#tip { position: fixed; pointer-events: none; z-index: 10; background: var(--surface); color: var(--ink); box-shadow: 0 0 0 1px var(--ring), 0 6px 20px rgba(0,0,0,.15); border-radius: 8px; padding: 8px 10px; font-size: 12px; max-width: 360px; display: none; }
#tip b { display: block; word-break: break-all; }
.scale { display: flex; gap: 2px; align-items: center; font-size: 12px; color: var(--ink-2); margin-top: 8px; }
.scale i { width: 28px; height: 10px; border-radius: 2px; display: inline-block; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid var(--grid); vertical-align: top; }
thead th { color: var(--ink-2); font-weight: 600; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.src { color: var(--muted); font-size: 11px; font-weight: normal; }
details summary { cursor: pointer; color: var(--ink-2); }
code { font-size: 12px; word-break: break-all; }
ul.files, ol.files { margin: 8px 0 0; padding-left: 20px; font-size: 13px; }
ul.files li, ol.files li { margin: 2px 0; }
.two { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
.lead.ok { color: var(--good-text); font-weight: 600; } .lead.bad { color: var(--critical); font-weight: 600; }
@media (max-width: 640px) { #treemap { height: 480px; } .tile .value { font-size: 26px; } }
</style>
</head>
<body>
<main>
  <h1>コード健康診断</h1>
  <p class="meta">${escapeHtml(report.label)} ・ ${escapeHtml(report.generatedAt.slice(0, 16).replace("T", " "))} UTC ・ ${t.files.toLocaleString()}ファイル / ${t.lines.toLocaleString()}行（空行を除く）</p>
  <ul class="kinds">${kinds}</ul>

  ${diffSection(diff)}

  <section>
    <h2>最適な状態との比較</h2>
    <div class="tiles">${metricCards(report, diff)}</div>
  </section>

  <section>
    <h2>アプリ本体の内訳 <small>テスト・型・生成物を除く ${t.productLines.toLocaleString()}行</small></h2>
    <p class="meta">点線より右（共通UI・共通ロジック）が厚いほど、ページ同士で部品やロジックを使い回せています。</p>
    ${compositionBar(report)}
  </section>

  <section>
    <h2>コードの地図</h2>
    <div class="controls" role="group" aria-label="色分け">
      <span>色分け:</span>
      <button type="button" data-mode="role" aria-pressed="true">機能</button>
      <button type="button" data-mode="dup" aria-pressed="false">コピペの割合</button>
      <button type="button" data-mode="rules" aria-pressed="false">ルール違反の数</button>
    </div>
    <div id="treemap" role="img" aria-label="ファイルを行数の大きさで並べた地図"></div>
    <ul class="legend" id="legend"></ul>
    <div class="scale" id="scale" hidden></div>
  </section>

  <section>
    <h2>書き方のルール <small>CLAUDE.md・DESIGN_SYSTEM.md で決めていること</small></h2>
    ${ruleTable(report, diff)}
  </section>

  <section>
    <h2>コピペの塊 <small>8行以上そっくり同じ並び（長い順・上位${MAX_CLONES}件）</small></h2>
    ${cloneTable(report)}
  </section>

  <section>
    <h2>分割・統合の候補</h2>
    ${listSection(report)}
  </section>
</main>
<div id="tip" role="tooltip"></div>
<script>
const DATA = ${jsonForScript(data)};
const ROLE_LABEL = Object.fromEntries(DATA.roles.map((r) => [r.id, r.label]));
const RULE_LABEL = Object.fromEntries(DATA.rules.map((r) => [r.id, r.label]));
let mode = "role";
let focusRole = null;

function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((s, it) => s + it.value, 0);
  if (total <= 0 || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  const nodes = items.map((it) => ({ it, area: it.value * scale })).sort((a, b) => b.area - a.area);
  let rx = x, ry = y, rw = w, rh = h;
  let row = [];
  const worst = (row, side) => {
    const s = row.reduce((a, n) => a + n.area, 0);
    let max = 0, min = Infinity;
    for (const n of row) { max = Math.max(max, n.area); min = Math.min(min, n.area); }
    return Math.max((side * side * max) / (s * s), (s * s) / (side * side * min));
  };
  const layoutRow = (row) => {
    const s = row.reduce((a, n) => a + n.area, 0);
    if (rw >= rh) {
      const cw = s / rh; let cy = ry;
      for (const n of row) { const ch = n.area / cw; out.push({ it: n.it, x: rx, y: cy, w: cw, h: ch }); cy += ch; }
      rx += cw; rw -= cw;
    } else {
      const ch = s / rw; let cx = rx;
      for (const n of row) { const cw = n.area / ch; out.push({ it: n.it, x: cx, y: ry, w: cw, h: ch }); cx += cw; }
      ry += ch; rh -= ch;
    }
  };
  for (const n of nodes) {
    const side = Math.min(rw, rh);
    if (row.length === 0 || worst([...row, n], side) <= worst(row, side)) row.push(n);
    else { layoutRow(row); row = [n]; }
  }
  if (row.length) layoutRow(row);
  return out;
}

function ruleCount(f) { return Object.values(f.h).reduce((s, n) => s + n, 0); }
function seqStep(v, cuts) { let i = 0; while (i < cuts.length && v > cuts[i]) i++; return "var(--seq-" + i + ")"; }
const DUP_CUTS = [0, 5, 10, 20, 35, 50];
const RULE_CUTS = [0, 2, 5, 10, 20, 40];
function colorOf(f) {
  if (mode === "dup") return seqStep(f.l ? (f.d / f.l) * 100 : 0, DUP_CUTS);
  if (mode === "rules") return seqStep(ruleCount(f), RULE_CUTS);
  return "var(--role-" + f.r + ")";
}

function render() {
  const el = document.getElementById("treemap");
  el.innerHTML = "";
  const W = el.clientWidth, H = el.clientHeight;
  const areas = new Map();
  for (const f of DATA.files) {
    if (!areas.has(f.a)) areas.set(f.a, []);
    areas.get(f.a).push(f);
  }
  const groups = [...areas].map(([name, files]) => ({ name, files, value: files.reduce((s, f) => s + f.l, 0) }));
  for (const g of squarify(groups, 0, 0, W, H)) {
    const box = document.createElement("div");
    box.className = "area";
    Object.assign(box.style, { left: g.x + "px", top: g.y + "px", width: g.w + "px", height: g.h + "px" });
    el.appendChild(box);
    const header = g.w > 60 && g.h > 34 ? 15 : 0;
    if (header) {
      const lab = document.createElement("div");
      lab.className = "area-label";
      lab.textContent = g.it.name;
      box.appendChild(lab);
    }
    for (const t of squarify(g.it.files.map((f) => ({ ...f, value: f.l })), 1, header + 1, g.w - 2, g.h - header - 2)) {
      const f = t.it;
      const tile = document.createElement("div");
      tile.className = "tile-file" + (mode === "role" && focusRole && f.r !== focusRole ? " dim" : "");
      Object.assign(tile.style, { left: t.x + "px", top: t.y + "px", width: Math.max(t.w, 1) + "px", height: Math.max(t.h, 1) + "px", background: colorOf(f) });
      tile.addEventListener("mousemove", (e) => showTip(e, f));
      tile.addEventListener("mouseleave", hideTip);
      box.appendChild(tile);
    }
  }
  renderLegend();
}

function renderLegend() {
  const legend = document.getElementById("legend");
  const scale = document.getElementById("scale");
  legend.innerHTML = "";
  if (mode === "role") {
    scale.hidden = true;
    legend.hidden = false;
    for (const r of DATA.roles) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-pressed", String(focusRole === r.id));
      b.innerHTML = '<span class="sw" style="background:var(--role-' + r.id + ')"></span>' + r.label;
      b.addEventListener("click", () => { focusRole = focusRole === r.id ? null : r.id; render(); });
      li.appendChild(b);
      legend.appendChild(li);
    }
    return;
  }
  legend.hidden = true;
  scale.hidden = false;
  const cuts = mode === "dup" ? DUP_CUTS : RULE_CUTS;
  const unit = mode === "dup" ? "%" : "件";
  const labels = ["0", ...cuts.slice(1).map((c, i) => (cuts[i] + (mode === "dup" ? "" : 1)) + "〜" + c + unit), cuts[cuts.length - 1] + unit + "超"];
  scale.innerHTML = (mode === "dup" ? "ファイル内のコピペ行の割合: " : "ルールに当たった数: ") +
    labels.map((l, i) => '<i style="background:var(--seq-' + i + ')" title="' + l + '"></i>').join("") +
    " <span>少ない → 多い</span>";
}

const tip = document.getElementById("tip");
function showTip(e, f) {
  const hits = Object.entries(f.h).map(([k, n]) => RULE_LABEL[k] + " " + n).join("<br>");
  tip.innerHTML = "<b>" + f.p.replace(/</g, "&lt;") + "</b>" + ROLE_LABEL[f.r] + " ・ " + f.l.toLocaleString() + "行" +
    (f.d ? "<br>コピペ " + f.d + "行（" + Math.round((f.d / f.l) * 100) + "%）" : "") + (hits ? "<br>" + hits : "");
  tip.style.display = "block";
  const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8);
  const y = e.clientY + 14 + tip.offsetHeight > window.innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 14;
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
function hideTip() { tip.style.display = "none"; }

document.querySelectorAll(".controls button").forEach((b) => b.addEventListener("click", () => {
  mode = b.dataset.mode;
  document.querySelectorAll(".controls button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  render();
}));
document.querySelectorAll(".compo-bar .seg").forEach((s) => {
  s.addEventListener("mousemove", (e) => { tip.innerHTML = s.dataset.tip; tip.style.display = "block"; tip.style.left = (e.clientX + 14) + "px"; tip.style.top = (e.clientY + 14) + "px"; });
  s.addEventListener("mouseleave", hideTip);
});
let resizeTimer;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(render, 150); });
render();
</script>
</body>
</html>
`;
}
