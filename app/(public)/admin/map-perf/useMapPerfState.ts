import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BenchmarkReport } from "@/lib/perf/mapBenchmark";
import { METRIC_DEFS, computeMetrics, median, type MetricKey, type MetricValues } from "@/lib/perf/metrics";
import type { BuildInfo } from "@/lib/perf/buildInfo";
import {
  DEFAULT_MAP_FEATURE_FLAGS,
  MAP_FEATURE_FLAG_DEFS,
  serializeMapFlags,
  type MapFeatureFlagKey,
  type MapFeatureFlags,
} from "@/lib/mapFeatureFlags";
import type { NicchyoMapBench } from "@/app/(public)/map/components/MapPerfBridge";
import { envLabel, fmtDate, shortSha, type AbVariantResult, type RunRow } from "./MapPerfPieces";

export const VIEWPORTS = [
  { key: "phone", label: "スマホ (390×780)", width: 390, height: 780 },
  { key: "tablet", label: "タブレット (820×1000)", width: 820, height: 1000 },
  { key: "desktop", label: "PC (1280×800)", width: 1280, height: 800 },
] as const;
export type ViewportKey = (typeof VIEWPORTS)[number]["key"];

export const SHOP_COUNTS = [
  { key: "real", label: "実データのまま", count: 0, param: "" },
  { key: "300", label: "300 店舗（本番規模）", count: 300, param: "&perfShops=300" },
  { key: "600", label: "600 店舗（負荷テスト）", count: 600, param: "&perfShops=600" },
] as const;
export type ShopCountKey = (typeof SHOP_COUNTS)[number]["key"];

export const REPEATS = [1, 3, 5] as const;

export const BRANCH_COLORS = ["#7ED957", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6", "#14b8a6", "#ef4444", "#64748b"];

/**
 * マップ性能計測画面（/admin/map-perf）の状態一式。
 *
 * 計測条件（画面サイズ・店舗数・回数・実験フラグ）、実行（run / A/B比較）、
 * 保存、ログの読み込み・絞り込み・グラフ用データまで、この画面が持つ状態と
 * 操作をすべてここに集約する。画面（MapPerfClient.tsx）側はこれを呼び、
 * 返ってきた値をそのまま表示に使うだけにする。
 */
export function useMapPerfState(buildInfo: BuildInfo) {
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

  return {
    iframeRef,
    viewport,
    setViewport,
    shopCount,
    setShopCount,
    repeat,
    setRepeat,
    flagOverride,
    setFlagOverride,
    compareKey,
    setCompareKey,
    abResults,
    abRunning,
    ready,
    running,
    progress,
    error,
    latest,
    label,
    setLabel,
    saving,
    savedNote,
    runs,
    loadingRuns,
    branchFilter,
    setBranchFilter,
    sameConditionOnly,
    setSameConditionOnly,
    metricKey,
    setMetricKey,
    compareA,
    setCompareA,
    compareB,
    setCompareB,
    vp,
    sc,
    iframeSrc,
    frameKey,
    loadRuns,
    reload,
    runCompare,
    saveCompare,
    run,
    save,
    remove,
    branches,
    branchColor,
    filteredRuns,
    metricDef,
    chartData,
    runA,
    runB,
    latestMedian,
  };
}
