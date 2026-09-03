/**
 * マップ描画のベンチマークを CLI から回す
 *
 * 管理画面 /admin/map-perf と同じ計測（lib/perf/mapBenchmark.ts）を、
 * Playwright で開いたブラウザ内で実行する。人でも AI でも同じ手順で数字が取れる。
 *
 * 使い方:
 *   node scripts/map-bench.mjs --url http://localhost:3000 --label "変更前" --runs 3 --cpu 4 --save
 *
 * オプション:
 *   --url       計測対象のオリジン（既定: http://localhost:3000）
 *   --label     ログに付けるラベル
 *   --runs      繰り返し回数（既定: 3）。中央値を表示する
 *   --cpu       CPU スロットリング倍率（既定: 4 = 中位スマホ相当。1 で無効）
 *   --shops     店舗数（既定: 300。0 で実データのまま）
 *   --viewport  phone | tablet | desktop（既定: phone）
 *   --save      結果を map_perf_runs に保存する（.env.local の SUPABASE_SERVICE_ROLE_KEY が必要）
 *   --allow-remote  --url が localhost 以外でも --save を許可する（プレビュー環境の計測を保存したいとき）
 *   --flags     マップ動作フラグの上書き（例: roadSnap:after,zoomSkip:off）。lib/mapFeatureFlags.ts を参照
 *   --compare   1 つのフラグの全選択肢を順に計測して並べる（例: --compare stallRenderer）
 *   --json      生のレポートを標準出力に JSON で出す
 *
 * 前提:
 *   - 対象サーバーが起動していること（npm run dev など）
 *   - Google Chrome がインストールされていること（無ければ Playwright の Chromium を使う）
 */

import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  if (i < 0) return fallback;
  const v = args[i + 1];
  return v === undefined || v.startsWith("--") ? true : v;
};

const url = String(opt("url", "http://localhost:3000")).replace(/\/$/, "");
const label = String(opt("label", ""));
const runs = Number(opt("runs", 3));
const cpu = Number(opt("cpu", 4));
const shops = Number(opt("shops", 300));
const viewportKey = String(opt("viewport", "phone"));
const save = opt("save", false) === true;
const allowRemote = opt("allow-remote", false) === true;
const asJson = opt("json", false) === true;

// --save は .env.local の service role key で直接 DB に書く。
// 対象がローカル以外のときは、意図せず本番の数字を混ぜないよう明示フラグを要求する。
const isLocalTarget = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
if (save && !isLocalTarget && !allowRemote) {
  console.error(`--save はローカル (localhost) 向けのみ既定で許可します。${url} に対して保存するには --allow-remote を付けてください。`);
  process.exit(1);
}

const VIEWPORTS = {
  phone: { width: 390, height: 780, dpr: 2, mobile: true },
  tablet: { width: 820, height: 1000, dpr: 2, mobile: true },
  desktop: { width: 1280, height: 800, dpr: 1, mobile: false },
};
const viewport = VIEWPORTS[viewportKey] ?? VIEWPORTS.phone;

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return "";
  }
}

// ---- 指標（lib/perf/metrics.ts と同じ定義。CLI は TS を読めないので要点だけ写している） ----
function zoomAgg(r) {
  const steps = r.zoomSteps ?? [];
  const n = steps.length || 1;
  return {
    dropped: steps.reduce((s, z) => s + z.droppedFrames, 0),
    max: steps.reduce((m, z) => Math.max(m, z.maxMs), 0),
    longTask: steps.reduce((s, z) => s + z.longTaskMs, 0),
    endAvg: steps.reduce((s, z) => s + z.zoomEndMs, 0) / n,
    markerMax: steps.reduce((m, z) => Math.max(m, z.markerCount ?? 0), r.dom.markerCount),
    elementsMax: steps.reduce((m, z) => Math.max(m, z.markerPaneElements ?? 0), r.dom.markerPaneElements),
  };
}
const METRICS = [
  ["ズーム完了までの平均 (ms)", (r) => zoomAgg(r).endAvg, 0],
  ["ズーム中のコマ落ち（合計）", (r) => zoomAgg(r).dropped, 0],
  ["ズーム中の最長フレーム (ms)", (r) => zoomAgg(r).max, 1],
  ["ズーム中のロングタスク（合計, ms）", (r) => zoomAgg(r).longTask, 0],
  ["パン中のコマ落ち", (r) => r.pan.droppedFrames, 0],
  ["一斉ハイライト: 描画完了まで (ms)", (r) => r.highlight.applyPaintMs, 1],
  ["ハイライト解除: 描画完了まで (ms)", (r) => r.highlight.clearPaintMs, 1],
  ["DOM 上のマーカー数（最大）", (r) => zoomAgg(r).markerMax, 0],
  ["マーカーペインの DOM 要素数（最大）", (r) => zoomAgg(r).elementsMax, 0],
  ["JS ヒープ (MB)", (r) => r.dom.jsHeapMb ?? 0, 1],
];
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  if (s.length === 0) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ---- ブラウザ ----
const { chromium } = await import("playwright");
let browser;
try {
  browser = await chromium.launch({ headless: false, channel: "chrome" });
} catch {
  browser = await chromium.launch({ headless: false });
}
const context = await browser.newContext({
  viewport: { width: viewport.width, height: viewport.height },
  deviceScaleFactor: viewport.dpr,
  isMobile: viewport.mobile,
  hasTouch: viewport.mobile,
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });

const flags = opt("flags", "");
// --compare <flagKey>: そのフラグの全選択肢を順に計測して並べる（例: --compare stallRenderer）
const compareKey = String(opt("compare", ""));
const COMPARE_OPTIONS = {
  stallRenderer: ["svg", "div"],
  roadSnap: ["off", "after", "integrated"],
  zoomSkip: ["off", "after", "before"],
  zoomRenderIsolation: ["on", "off"],
  landmarkCssScale: ["on", "off"],
  backgroundOverlay: ["webp", "svg", "off"],
  tileOpacityByZoom: ["on", "off"],
  shopLayerHiding: ["on", "off"],
  renderer: ["leaflet", "maplibre"],
  basemap: ["raster-carto", "vector-openfreemap"],
};
if (compareKey && !COMPARE_OPTIONS[compareKey]) {
  console.error(`--compare に使えるのは: ${Object.keys(COMPARE_OPTIONS).join(", ")}`);
  process.exit(1);
}
const baseFlags = typeof flags === "string" && flags ? flags : "";
const variants = compareKey
  ? COMPARE_OPTIONS[compareKey].map((v) => ({ name: `${compareKey}=${v}`, flags: [baseFlags, `${compareKey}:${v}`].filter(Boolean).join(",") }))
  : [{ name: "", flags: baseFlags }];
const targetFor = (f) =>
  `${url}/map?perf=1${shops > 0 ? `&perfShops=${shops}` : ""}${f ? `&mapFlags=${encodeURIComponent(f)}` : ""}`;
const target = targetFor(baseFlags);
// ---- 計測（--compare のときは選択肢ごとに順に回す） ----
const results = []; // { name, flags, reports }
for (const variant of variants) {
  const variantTarget = targetFor(variant.flags);
  const reports = [];
  for (let i = 0; i < runs; i++) {
    await page.goto(variantTarget, { waitUntil: "networkidle" });
    await page.waitForFunction(() => !!window.__nicchyoMapBench, null, { timeout: 60000 });
    // Leaflet は DOM マーカーが出るまで、MapLibre（GPU 描画、DOM マーカー無し）は Map 本体の公開まで待つ
    await page.waitForFunction(
      () => document.querySelectorAll(".custom-shop-marker").length >= 5 || !!window.__nicchyoMapLibre,
      null,
      { timeout: 60000 }
    );
    await page.waitForTimeout(4000);
    const report = await page.evaluate(() => window.__nicchyoMapBench.run());
    reports.push(report);
    console.error(`${variant.name ? `[${variant.name}] ` : ""}run ${i + 1}/${runs}: zoomEndAvg=${Math.round(zoomAgg(report).endAvg)}ms dropped=${zoomAgg(report).dropped}`);
  }
  results.push({ ...variant, reports });
}
await browser.close();

// ---- 出力 ----
const branch = git("rev-parse --abbrev-ref HEAD");
const sha = git("rev-parse HEAD");
console.log(`\n## マップ計測  ${label || "(ラベルなし)"}`);
console.log(`- 対象: ${target}`);
console.log(`- コード: ${branch} @ ${sha.slice(0, 7)}`);
console.log(`- 条件: ${viewport.width}×${viewport.height} / ${shops || "実データ"} 店舗 / CPU×${cpu} / ${runs} 回の中央値${compareKey ? ` / 比較: ${compareKey}` : ""}\n`);
const header = results.map((r) => r.name || "中央値");
console.log(`| 指標（小さいほど良い） | ${header.join(" | ")} |${results.length === 2 ? " 変化 |" : ""}`);
console.log(`|---|${header.map(() => "---").join("|")}|${results.length === 2 ? "---|" : ""}`);
for (const [name, pick, d] of METRICS) {
  const vals = results.map((r) => median(r.reports.map(pick)));
  let delta = "";
  if (results.length === 2) {
    if (vals[0] > 0) {
      const ratio = ((vals[1] - vals[0]) / vals[0]) * 100;
      delta = ` ${ratio > 0 ? "+" : ""}${ratio.toFixed(0)}% |`;
    } else {
      delta = " - |";
    }
  }
  console.log(`| ${name} | ${vals.map((v) => v.toFixed(d)).join(" | ")} |${delta}`);
}
if (asJson) console.log("\n" + JSON.stringify(results.length === 1 ? results[0].reports : results));

// ---- 保存 ----
if (save) {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* シェルの環境変数を使う */
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("\n保存には NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が必要です（.env.local）");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const base = label || `CLI 計測 ${new Date().toLocaleString("ja-JP")}`;
  const rows = [];
  for (const r of results) {
    r.reports.forEach((report, i) => {
      const variantLabel = r.name ? ` [${r.name}]` : "";
      rows.push({
        label: `${base}${variantLabel}${r.reports.length > 1 ? ` (${i + 1}/${r.reports.length})` : ""}`,
        branch,
        commit_sha: sha,
        environment: "cli",
        deployment_url: url,
        viewport_width: report.viewport.width,
        viewport_height: report.viewport.height,
        device_pixel_ratio: report.viewport.dpr,
        shop_count: shops,
        cpu_throttle: cpu,
        user_agent: report.userAgent,
        report,
      });
    });
  }
  const { error } = await supabase.from("map_perf_runs").insert(rows);
  if (error) {
    console.error("\n保存に失敗しました:", error.message);
    process.exit(1);
  }
  console.log(`\n${rows.length} 件を map_perf_runs に保存しました。`);
}
