"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BenchmarkReport, FrameStats } from "@/lib/perf/mapBenchmark";
import {
  METRIC_DEFS,
  computeMetrics,
  formatMetric,
  improvementRatio,
  median,
  type MetricKey,
  type MetricValues,
} from "@/lib/perf/metrics";
import type { BuildInfo } from "@/lib/perf/buildInfo";
import {
  DEFAULT_MAP_FEATURE_FLAGS,
  MAP_FEATURE_FLAG_DEFS,
  serializeMapFlags,
  type MapFeatureFlagKey,
  type MapFeatureFlags,
} from "@/lib/mapFeatureFlags";
import type { NicchyoMapBench } from "@/app/(public)/map/components/MapPerfBridge";
import { PillSelect } from "@/components/admin/PillSelect";

/** API が返す 1 件（生レポートは含まない） */
interface RunRow {
  id: string;
  created_at: string;
  label: string;
  branch: string;
  commit_sha: string;
  environment: string;
  deployment_url: string;
  viewport_width: number;
  viewport_height: number;
  device_pixel_ratio: number;
  shop_count: number;
  cpu_throttle: number;
  user_agent: string;
  metrics: MetricValues | null;
  /** 計測時に有効だったマップ動作フラグ（古いログには無い） */
  flags?: Record<string, string | boolean> | null;
}

/** フラグを短い文字列にする（例: snap=integrated skip=before iso=on lm=on） */
function flagsSummary(flags: RunRow["flags"]): string {
  if (!flags) return "-";
  const short: Record<string, string> = {
    roadSnap: "snap",
    zoomSkip: "skip",
    zoomRenderIsolation: "iso",
    landmarkCssScale: "lm",
    stallRenderer: "stall",
    backgroundOverlay: "bg",
    tileOpacityByZoom: "tile",
    shopLayerHiding: "hide",
  };
  return Object.entries(flags)
    .map(([k, v]) => `${short[k] ?? k}=${typeof v === "boolean" ? (v ? "on" : "off") : v}`)
    .join(" ");
}

const VIEWPORTS = [
  { key: "phone", label: "スマホ (390×780)", width: 390, height: 780 },
  { key: "tablet", label: "タブレット (820×1000)", width: 820, height: 1000 },
  { key: "desktop", label: "PC (1280×800)", width: 1280, height: 800 },
] as const;
type ViewportKey = (typeof VIEWPORTS)[number]["key"];

const SHOP_COUNTS = [
  { key: "real", label: "実データのまま", count: 0, param: "" },
  { key: "300", label: "300 店舗（本番規模）", count: 300, param: "&perfShops=300" },
  { key: "600", label: "600 店舗（負荷テスト）", count: 600, param: "&perfShops=600" },
] as const;
type ShopCountKey = (typeof SHOP_COUNTS)[number]["key"];

const REPEATS = [1, 3, 5] as const;

const BRANCH_COLORS = ["#7ED957", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#64748b"];

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

function shortSha(sha: string): string {
  return sha ? sha.slice(0, 7) : "-";
}

function envLabel(env: string): string {
  switch (env) {
    case "production":
      return "本番";
    case "preview":
      return "プレビュー";
    case "local":
      return "ローカル";
    case "cli":
      return "CLI";
    default:
      return env || "不明";
  }
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function FrameStatsCells({ s }: { s: FrameStats }) {
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums">{s.frames}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.avgMs)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.p95Ms)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.maxMs)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${s.droppedFrames > 0 ? "font-semibold text-red-600" : ""}`}>
        {s.droppedFrames}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.longTaskMs, 0)}</td>
    </>
  );
}

export default function MapPerfClient({ buildInfo }: { buildInfo: BuildInfo }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // 計測条件
  const [viewport, setViewport] = useState<ViewportKey>("phone");
  const [shopCount, setShopCount] = useState<ShopCountKey>("300");
  const [repeat, setRepeat] = useState<(typeof REPEATS)[number]>(1);
  // 実験スイッチ。null は「本番設定のまま」、値があれば URL で上書きする
  const [flagOverride, setFlagOverride] = useState<MapFeatureFlags | null>(null);
  // iframe を読み直したことを確実に検知するための通し番号（URL に載せる）
  const [frameNonce, setFrameNonce] = useState(1);
  // A/B 比較: 選んだフラグの全選択肢を順に計測する
  const [compareKey, setCompareKey] = useState<MapFeatureFlagKey | "">("");
  const [abResults, setAbResults] = useState<AbVariantResult[]>([]);
  const [abRunning, setAbRunning] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [ready, setReady] = useState(false);

  // 実行状態
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<BenchmarkReport[]>([]);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // ログ
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [branchFilter, setBranchFilter] = useState<string>("");
  const [sameConditionOnly, setSameConditionOnly] = useState(true);
  const [metricKey, setMetricKey] = useState<MetricKey>("zoomEndAvgMs");
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");

  const vp = useMemo(() => VIEWPORTS.find((v) => v.key === viewport) ?? VIEWPORTS[0], [viewport]);
  const sc = useMemo(() => SHOP_COUNTS.find((s) => s.key === shopCount) ?? SHOP_COUNTS[0], [shopCount]);
  const iframeSrc = `/map?perf=1${sc.param}${
    flagOverride ? `&mapFlags=${encodeURIComponent(serializeMapFlags(flagOverride))}` : ""
  }&n=${frameNonce}`;

  const getBench = useCallback((): NicchyoMapBench | null => {
    const win = iframeRef.current?.contentWindow as (Window & { __nicchyoMapBench?: NicchyoMapBench }) | null;
    return win?.__nicchyoMapBench ?? null;
  }, []);

  // iframe 側の準備待ち（同一オリジンなので直接覗ける）
  useEffect(() => {
    setReady(false);
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      if (getBench()) {
        setReady(true);
        return;
      }
      setTimeout(tick, 300);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [frameKey, getBench]);

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    try {
      const res = await fetch("/api/admin/map-perf/runs?limit=300", { cache: "no-store" });
      if (!res.ok) throw new Error(`一覧の取得に失敗しました (${res.status})`);
      const json = (await res.json()) as { runs: RunRow[] };
      setRuns(json.runs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const reload = () => {
    setLatest([]);
    setSavedNote(null);
    setError(null);
    setFrameKey((k) => k + 1);
    setFrameNonce((n) => n + 1);
  };

  /** iframe が指定の nonce で読み込まれ、計測フックが使えるようになるまで待つ */
  const waitForFrame = useCallback(
    (nonce: number, timeoutMs = 60000) =>
      new Promise<NicchyoMapBench>((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
          const win = iframeRef.current?.contentWindow as (Window & { __nicchyoMapBench?: NicchyoMapBench }) | null;
          let search = "";
          try {
            search = win?.location?.search ?? "";
          } catch {
            search = "";
          }
          if (win?.__nicchyoMapBench && search.includes(`n=${nonce}`)) {
            resolve(win.__nicchyoMapBench);
            return;
          }
          if (Date.now() - started > timeoutMs) {
            reject(new Error("マップの読み込みがタイムアウトしました"));
            return;
          }
          setTimeout(tick, 300);
        };
        tick();
      }),
    []
  );

  /** A/B 比較: compareKey の全選択肢について、順に iframe を読み直して repeat 回ずつ計測する */
  const runCompare = async () => {
    const def = MAP_FEATURE_FLAG_DEFS.find((d) => d.key === compareKey);
    if (!def) return;
    const options = def.options === "boolean" ? [true, false] : [...def.options];
    setAbRunning(true);
    setRunning(true);
    setError(null);
    setSavedNote(null);
    setAbResults([]);
    const base = flagOverride ?? { ...DEFAULT_MAP_FEATURE_FLAGS };
    const results: AbVariantResult[] = [];
    try {
      for (const option of options) {
        const flags = { ...base, [def.key]: option } as MapFeatureFlags;
        const variant = typeof option === "boolean" ? (option ? "on" : "off") : option;
        setProgress(`${def.label} = ${variant}: マップを読み込み中`);
        const nonce = Date.now();
        setFlagOverride(flags);
        setFrameNonce(nonce);
        setFrameKey((k) => k + 1);
        const bench = await waitForFrame(nonce);
        await new Promise((r) => setTimeout(r, 1500));
        const reports: BenchmarkReport[] = [];
        for (let i = 0; i < repeat; i++) {
          const report = await bench.run((p) => setProgress(`${def.label} = ${variant} (${i + 1}/${repeat}): ${p}`));
          reports.push(report);
        }
        results.push({ key: def.key, variant, flags, reports });
        setAbResults([...results]);
      }
      setProgress("完了");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAbRunning(false);
      setRunning(false);
    }
  };

  const saveCompare = async () => {
    if (abResults.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const base = label.trim() || `A/B ${new Date().toLocaleString("ja-JP")}`;
      let count = 0;
      for (const v of abResults) {
        for (let i = 0; i < v.reports.length; i++) {
          const report = v.reports[i];
          const res = await fetch("/api/admin/map-perf/runs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              label: `${base} [${v.key}=${v.variant}]${v.reports.length > 1 ? ` (${i + 1}/${v.reports.length})` : ""}`,
              branch: buildInfo.branch,
              commitSha: buildInfo.commitSha,
              environment: buildInfo.environment,
              deploymentUrl: buildInfo.deploymentUrl || window.location.origin,
              viewportWidth: report.viewport.width,
              viewportHeight: report.viewport.height,
              devicePixelRatio: report.viewport.dpr,
              shopCount: sc.count,
              cpuThrottle: 1,
              userAgent: report.userAgent,
              report,
            }),
          });
          if (!res.ok) throw new Error(`保存に失敗しました (${res.status})`);
          count++;
        }
      }
      setSavedNote(`${count} 件を保存しました`);
      setLabel("");
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const run = async () => {
    const bench = getBench();
    if (!bench) {
      setError("マップの準備ができていません。少し待ってから再実行してください。");
      return;
    }
    setRunning(true);
    setError(null);
    setSavedNote(null);
    setLatest([]);
    try {
      const reports: BenchmarkReport[] = [];
      for (let i = 0; i < repeat; i++) {
        setProgress(`${i + 1}/${repeat} 回目: 開始`);
        await new Promise((r) => setTimeout(r, 800));
        const report = await bench.run((p) => setProgress(`${i + 1}/${repeat} 回目: ${p}`));
        reports.push(report);
        setLatest([...reports]);
      }
      setProgress("完了");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const save = async () => {
    if (latest.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      const base = label.trim() || `計測 ${new Date().toLocaleString("ja-JP")}`;
      for (let i = 0; i < latest.length; i++) {
        const report = latest[i];
        const res = await fetch("/api/admin/map-perf/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            label: latest.length > 1 ? `${base} (${i + 1}/${latest.length})` : base,
            branch: buildInfo.branch,
            commitSha: buildInfo.commitSha,
            environment: buildInfo.environment,
            deploymentUrl: buildInfo.deploymentUrl || window.location.origin,
            viewportWidth: report.viewport.width,
            viewportHeight: report.viewport.height,
            devicePixelRatio: report.viewport.dpr,
            shopCount: sc.count,
            cpuThrottle: 1,
            userAgent: report.userAgent,
            report,
          }),
        });
        if (!res.ok) throw new Error(`保存に失敗しました (${res.status})`);
      }
      setSavedNote(`${latest.length} 件を保存しました`);
      setLabel("");
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("この計測結果を削除しますか？")) return;
    const res = await fetch(`/api/admin/map-perf/runs?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) {
      setError(`削除に失敗しました (${res.status})`);
      return;
    }
    await loadRuns();
  };

  // ---- ログの絞り込み・グラフ用データ ----
  const branches = useMemo(() => Array.from(new Set(runs.map((r) => r.branch || "(不明)"))), [runs]);
  const branchColor = useMemo(() => {
    const m = new Map<string, string>();
    branches.forEach((b, i) => m.set(b, BRANCH_COLORS[i % BRANCH_COLORS.length]));
    return m;
  }, [branches]);

  const filteredRuns = useMemo(() => {
    return runs.filter((r) => {
      if (branchFilter && (r.branch || "(不明)") !== branchFilter) return false;
      if (sameConditionOnly) {
        if (r.viewport_width !== vp.width || r.viewport_height !== vp.height) return false;
        if (r.shop_count !== sc.count) return false;
      }
      return true;
    });
  }, [runs, branchFilter, sameConditionOnly, vp, sc]);

  const metricDef = METRIC_DEFS.find((d) => d.key === metricKey) ?? METRIC_DEFS[0];

  const chartData = useMemo(() => {
    return [...filteredRuns]
      .reverse() // 古い順に左から
      .map((r) => ({
        id: r.id,
        name: `${fmtDate(r.created_at)} ${r.label}`.trim(),
        value: r.metrics?.[metricKey] ?? null,
        branch: r.branch || "(不明)",
        sha: shortSha(r.commit_sha),
        env: envLabel(r.environment),
      }));
  }, [filteredRuns, metricKey]);

  const runA = runs.find((r) => r.id === compareA) ?? null;
  const runB = runs.find((r) => r.id === compareB) ?? null;

  const latestMetrics = useMemo(() => latest.map((r) => computeMetrics(r)), [latest]);
  const latestMedian = useMemo(() => {
    if (latestMetrics.length === 0) return null;
    const out = {} as MetricValues;
    for (const d of METRIC_DEFS) {
      out[d.key] = median(latestMetrics.map((m) => m[d.key]).filter((v): v is number => v !== null));
    }
    return out;
  }, [latestMetrics]);

  return (
    <div className="space-y-8">
      {/* ビルド情報 */}
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm shadow-sm">
        <span className="text-slate-500">計測対象のコード</span>
        <Badge>{envLabel(buildInfo.environment)}</Badge>
        <Badge mono>{buildInfo.branch || "(ブランチ不明)"}</Badge>
        <Badge mono>{shortSha(buildInfo.commitSha)}</Badge>
        {buildInfo.deploymentUrl && <span className="truncate text-xs text-slate-400">{buildInfo.deploymentUrl}</span>}
      </section>

      {/* 操作 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Select label="画面サイズ" value={viewport} disabled={running} onChange={(v) => { setViewport(v as ViewportKey); reload(); }}>
            {VIEWPORTS.map((v) => (
              <option key={v.key} value={v.key}>{v.label}</option>
            ))}
          </Select>
          <Select label="店舗数" value={shopCount} disabled={running} onChange={(v) => { setShopCount(v as ShopCountKey); reload(); }}>
            {SHOP_COUNTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </Select>
          <Select label="回数" value={String(repeat)} disabled={running} onChange={(v) => setRepeat(Number(v) as (typeof REPEATS)[number])}>
            {REPEATS.map((n) => (
              <option key={n} value={n}>{n} 回</option>
            ))}
          </Select>
          <button type="button" onClick={reload} disabled={running} className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            マップを再読込
          </button>
          <button type="button" onClick={run} disabled={!ready || running} className="rounded-full bg-nicchyo-primary px-5 py-1.5 text-sm font-semibold text-nicchyo-ink shadow hover:brightness-95 disabled:opacity-50">
            {running ? "計測中…" : "計測を実行"}
          </button>
          <span className="text-sm text-slate-500">{ready ? (running ? progress : "準備完了") : "マップを読み込み中…"}</span>
        </div>
        {/* 実験スイッチ */}
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-nicchyo-primary"
                checked={flagOverride !== null}
                disabled={running}
                onChange={(e) => {
                  setFlagOverride(e.target.checked ? { ...DEFAULT_MAP_FEATURE_FLAGS } : null);
                  reload();
                }}
              />
              実験スイッチを使う（マップ動作フラグを URL で上書き）
            </label>
            {flagOverride === null && (
              <span className="text-xs text-slate-500">オフのときは本番設定（管理画面「設定」）のまま計測します</span>
            )}
          </div>
          {flagOverride && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {MAP_FEATURE_FLAG_DEFS.map((def) =>
                def.options === "boolean" ? (
                  <label key={def.key} className="flex items-center gap-1.5 text-slate-700">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded accent-nicchyo-primary"
                      checked={Boolean(flagOverride[def.key])}
                      disabled={running}
                      onChange={(e) => {
                        setFlagOverride({ ...flagOverride, [def.key]: e.target.checked });
                        reload();
                      }}
                    />
                    {def.label}
                  </label>
                ) : (
                  <Select
                    key={def.key}
                    label={def.label}
                    value={String(flagOverride[def.key])}
                    disabled={running}
                    onChange={(v) => {
                      setFlagOverride({ ...flagOverride, [def.key]: v });
                      reload();
                    }}
                  >
                    {def.options.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                )
              )}
            </div>
          )}
        </div>

        {/* A/B 比較 */}
        <div className="mt-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-slate-700">A/B 比較</span>
            <Select label="比較する要素" value={compareKey} disabled={running} onChange={(v) => setCompareKey(v as MapFeatureFlagKey | "")}>
              <option value="">選択</option>
              {MAP_FEATURE_FLAG_DEFS.map((def) => (
                <option key={def.key} value={def.key}>{def.label}</option>
              ))}
            </Select>
            <button
              type="button"
              onClick={runCompare}
              disabled={!compareKey || running}
              className="rounded-full bg-amber-500 px-5 py-1.5 text-sm font-semibold text-white shadow hover:brightness-95 disabled:opacity-50"
            >
              {abRunning ? "比較計測中…" : "全選択肢をまとめて計測"}
            </button>
            <span className="text-xs text-slate-500">
              選んだ要素の各選択肢について、マップを読み直して {repeat} 回ずつ計測します。他のフラグは実験スイッチの値（未使用なら既定値）で固定します。
            </span>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-slate-500">
          計測中はこのタブを前面にしたまま触らないでください。数字は端末やブラウザの状態で揺れるので、3 回以上取って中央値で比べるのがおすすめです。
          CPU を遅くした条件（スマホ相当）で測りたいときは Chrome の DevTools で CPU throttling を有効にするか、CLI の <code className="rounded bg-slate-100 px-1">node scripts/map-bench.mjs</code> を使ってください。
        </p>
      </section>

      {/* マップ本体 */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="mx-auto overflow-hidden rounded-xl border border-slate-300 bg-white shadow" style={{ width: vp.width, maxWidth: "100%" }}>
          <iframe
            key={frameKey}
            ref={iframeRef}
            src={iframeSrc}
            title="計測用マップ"
            width={vp.width}
            height={vp.height}
            className="block"
            style={{ width: vp.width, height: vp.height, maxWidth: "100%", border: 0 }}
          />
        </div>
      </section>

      {/* A/B 比較の結果 */}
      {abResults.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">
              A/B 比較の結果{repeat > 1 ? `（各 ${repeat} 回の中央値）` : ""}
            </h2>
            <div className="flex items-center gap-2">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ラベル（例: SVG vs div）" className="rounded-full border border-slate-300 px-3 py-1.5 text-sm" />
              <button type="button" onClick={saveCompare} disabled={saving || abRunning} className="rounded-full bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                {saving ? "保存中…" : "全部ログに保存"}
              </button>
              {savedNote && <span className="text-sm text-emerald-600">{savedNote}</span>}
            </div>
          </div>
          <AbComparisonTable results={abResults} />
        </section>
      )}

      {/* 今回の結果 */}
      {latest.length > 0 && latestMedian && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">
              今回の結果{latest.length > 1 ? `（${latest.length} 回の中央値）` : ""}
            </h2>
            <div className="flex items-center gap-2">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ラベル（例: SVG 化後）" className="rounded-full border border-slate-300 px-3 py-1.5 text-sm" />
              <button type="button" onClick={save} disabled={saving} className="rounded-full bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                {saving ? "保存中…" : "ログに保存"}
              </button>
              {savedNote && <span className="text-sm text-emerald-600">{savedNote}</span>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {METRIC_DEFS.filter((d) => d.primary).map((d) => (
              <Stat key={d.key} label={d.label} value={formatMetric(latestMedian[d.key], d)} />
            ))}
          </div>

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-slate-600">全指標とズーム段階ごとの内訳を見る</summary>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              {METRIC_DEFS.filter((d) => !d.primary).map((d) => (
                <Stat key={d.key} label={d.label} value={formatMetric(latestMedian[d.key], d)} />
              ))}
            </div>
            {latest.map((report, idx) => (
              <div key={idx} className="mt-4 overflow-x-auto">
                {latest.length > 1 && <div className="mb-1 text-xs font-semibold text-slate-500">{idx + 1} 回目</div>}
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2">場面</th>
                      <th className="px-3 py-2 text-right">フレーム数</th>
                      <th className="px-3 py-2 text-right">平均 ms</th>
                      <th className="px-3 py-2 text-right">p95 ms</th>
                      <th className="px-3 py-2 text-right">最長 ms</th>
                      <th className="px-3 py-2 text-right">コマ落ち</th>
                      <th className="px-3 py-2 text-right">ロングタスク ms</th>
                      <th className="px-3 py-2 text-right">完了まで ms</th>
                      <th className="px-3 py-2 text-right">DOM マーカー / 要素</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-2">アイドル</td>
                      <FrameStatsCells s={report.idle} />
                      <td className="px-3 py-2 text-right">-</td>
                      <td className="px-3 py-2 text-right tabular-nums">{report.dom.markerCount} / {report.dom.markerPaneElements}</td>
                    </tr>
                    {report.zoomSteps.map((z, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="px-3 py-2">ズーム {z.fromZoom} → {z.toZoom}</td>
                        <FrameStatsCells s={z} />
                        <td className="px-3 py-2 text-right tabular-nums">{fmt(z.zoomEndMs, 0)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{z.markerCount} / {z.markerPaneElements}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-slate-100">
                      <td className="px-3 py-2">パン</td>
                      <FrameStatsCells s={report.pan} />
                      <td className="px-3 py-2 text-right">-</td>
                      <td className="px-3 py-2 text-right">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </details>
        </section>
      )}

      {/* 推移グラフ */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-800">推移グラフ</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Select label="指標" value={metricKey} onChange={(v) => setMetricKey(v as MetricKey)}>
              {METRIC_DEFS.map((d) => (
                <option key={d.key} value={d.key}>{d.label}</option>
              ))}
            </Select>
            <Select label="ブランチ" value={branchFilter} onChange={setBranchFilter}>
              <option value="">すべて</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </Select>
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={sameConditionOnly} onChange={(e) => setSameConditionOnly(e.target.checked)} />
              今の条件（{vp.width}×{vp.height} / {sc.count || "実データ"}）だけ
            </label>
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500">該当する計測結果がありません。計測して「ログに保存」すると、ここに積み上がります。</p>
        ) : (
          <>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 48 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={60} />
                  <YAxis tick={{ fontSize: 11 }} unit={metricDef.unit === "ms" ? "ms" : ""} />
                  <Tooltip
                    formatter={(v) => [formatMetric(typeof v === "number" ? v : null, metricDef), metricDef.label]}
                    labelFormatter={(_, payload) => {
                      const p = payload?.[0]?.payload as (typeof chartData)[number] | undefined;
                      return p ? `${p.name}\n${p.branch} @ ${p.sha} (${p.env})` : "";
                    }}
                    contentStyle={{ fontSize: 12, whiteSpace: "pre-line" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((d) => (
                      <Cell key={d.id} fill={branchColor.get(d.branch) ?? "#94a3b8"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
              {branches.map((b) => (
                <span key={b} className="flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded-sm" style={{ background: branchColor.get(b) }} />
                  {b}
                </span>
              ))}
              <span className="text-slate-400">小さいほど良い</span>
            </div>
          </>
        )}
      </section>

      {/* 2 件比較 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-bold text-slate-800">2 件を比較</h2>
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <RunSelect label="A（変更前）" value={compareA} onChange={setCompareA} runs={filteredRuns} />
          <span className="text-slate-400">→</span>
          <RunSelect label="B（変更後）" value={compareB} onChange={setCompareB} runs={filteredRuns} />
        </div>
        {runA && runB && runA.metrics && runB.metrics ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">指標（小さいほど良い）</th>
                  <th className="px-3 py-2 text-right">{runA.label} <span className="font-mono text-slate-400">{shortSha(runA.commit_sha)}</span></th>
                  <th className="px-3 py-2 text-right">{runB.label} <span className="font-mono text-slate-400">{shortSha(runB.commit_sha)}</span></th>
                  <th className="px-3 py-2 text-right">改善率</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_DEFS.map((d) => {
                  const a = runA.metrics![d.key];
                  const b = runB.metrics![d.key];
                  const ratio = improvementRatio(a, b);
                  const tone =
                    ratio === null || Math.abs(ratio) < 0.05
                      ? "text-slate-500"
                      : ratio > 0
                        ? "font-semibold text-emerald-600"
                        : "font-semibold text-red-600";
                  return (
                    <tr key={d.key} className="border-b border-slate-100">
                      <td className="px-3 py-2">{d.label}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMetric(a, d)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatMetric(b, d)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${tone}`}>
                        {ratio === null ? "-" : `${ratio > 0 ? "-" : "+"}${fmt(Math.abs(ratio) * 100, 0)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">比較する 2 件を選んでください。</p>
        )}
      </section>

      {/* ログ一覧 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">計測結果ログ</h2>
          <button type="button" onClick={() => void loadRuns()} disabled={loadingRuns} className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {loadingRuns ? "読み込み中…" : "更新"}
          </button>
        </div>
        {filteredRuns.length === 0 ? (
          <p className="text-sm text-slate-500">まだ保存された計測結果がありません。</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">日時</th>
                  <th className="px-3 py-2">ラベル</th>
                  <th className="px-3 py-2">ブランチ</th>
                  <th className="px-3 py-2">コミット</th>
                  <th className="px-3 py-2">環境</th>
                  <th className="px-3 py-2">条件</th>
                  <th className="px-3 py-2">フラグ</th>
                  {METRIC_DEFS.filter((d) => d.primary).map((d) => (
                    <th key={d.key} className="px-3 py-2 text-right">{d.label}</th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-3 py-2 text-slate-600">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{r.label || "-"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: branchColor.get(r.branch || "(不明)") }} />
                        {r.branch || "-"}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500">{shortSha(r.commit_sha)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{envLabel(r.environment)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                      {r.viewport_width}×{r.viewport_height} / {r.shop_count || "実"}店 / CPU×{r.cpu_throttle}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-500">{flagsSummary(r.flags)}</td>
                    {METRIC_DEFS.filter((d) => d.primary).map((d) => (
                      <td key={d.key} className="px-3 py-2 text-right tabular-nums">{formatMetric(r.metrics?.[d.key] ?? null, d)}</td>
                    ))}
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => void remove(r.id)} className="text-xs text-slate-400 hover:text-red-600">削除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">
          CLI からも同じログに保存できます: <code className="rounded bg-slate-100 px-1">node scripts/map-bench.mjs --url http://localhost:3000 --label &quot;変更前&quot; --runs 3 --cpu 4 --save</code>
        </p>
      </section>
    </div>
  );
}

function Badge({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span className={`rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 ${mono ? "font-mono" : "font-medium"}`}>
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-800">{value}</div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  disabled,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <PillSelect label={label} value={value} onChange={onChange} disabled={disabled}>
      {children}
    </PillSelect>
  );
}

function RunSelect({ label, value, onChange, runs }: { label: string; value: string; onChange: (v: string) => void; runs: RunRow[] }) {
  return (
    <PillSelect
      label={label}
      value={value}
      onChange={onChange}
      placeholder="選択"
      menuClassName="min-w-[320px]"
      options={runs.map((r) => ({
        value: r.id,
        label: `${fmtDate(r.created_at)} ${r.label}`.trim(),
        description: `${r.branch} @ ${shortSha(r.commit_sha)} / ${envLabel(r.environment)} / ${flagsSummary(r.flags)}`,
      }))}
    />
  );
}

/** A/B 比較の 1 選択肢ぶんの結果 */
interface AbVariantResult {
  key: MapFeatureFlagKey;
  variant: string;
  flags: MapFeatureFlags;
  reports: BenchmarkReport[];
}

function AbComparisonTable({ results }: { results: AbVariantResult[] }) {
  const medians = results.map((v) => {
    const metrics = v.reports.map((r) => computeMetrics(r));
    const out = {} as MetricValues;
    for (const d of METRIC_DEFS) {
      out[d.key] = median(metrics.map((m) => m[d.key]).filter((x): x is number => x !== null));
    }
    return out;
  });
  const first = medians[0];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="px-3 py-2">指標（小さいほど良い）</th>
            {results.map((v) => (
              <th key={v.variant} className="px-3 py-2 text-right">
                {v.key} = <span className="font-mono">{v.variant}</span>
              </th>
            ))}
            {results.length === 2 && <th className="px-3 py-2 text-right">改善率（A→B）</th>}
          </tr>
        </thead>
        <tbody>
          {METRIC_DEFS.map((d) => {
            const ratio = results.length === 2 ? improvementRatio(first[d.key], medians[1][d.key]) : null;
            const tone =
              ratio === null || Math.abs(ratio) < 0.05
                ? "text-slate-500"
                : ratio > 0
                  ? "font-semibold text-emerald-600"
                  : "font-semibold text-red-600";
            return (
              <tr key={d.key} className="border-b border-slate-100">
                <td className="px-3 py-2">{d.label}</td>
                {medians.map((m, i) => (
                  <td key={i} className="px-3 py-2 text-right tabular-nums">{formatMetric(m[d.key], d)}</td>
                ))}
                {results.length === 2 && (
                  <td className={`px-3 py-2 text-right tabular-nums ${tone}`}>
                    {ratio === null ? "-" : `${ratio > 0 ? "-" : "+"}${fmt(Math.abs(ratio) * 100, 0)}%`}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        A = 最初の選択肢、B = 2 番目。3 つ以上のときは各列を見比べてください。数字は端末状態で揺れるので、回数を 3 以上にして中央値で見るのがおすすめです。
      </p>
    </div>
  );
}

