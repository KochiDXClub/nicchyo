"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BenchmarkReport, FrameStats } from "@/lib/perf/mapBenchmark";
import type { NicchyoMapBench } from "@/app/(public)/map/components/MapPerfBridge";

/** 保存した計測結果。ラベルを付けて before / after を並べて比べる */
interface SavedRun {
  id: string;
  label: string;
  report: BenchmarkReport;
}

const STORAGE_KEY = "nicchyo-map-perf-runs";

const VIEWPORTS = [
  { key: "phone", label: "スマホ (390×780)", width: 390, height: 780 },
  { key: "tablet", label: "タブレット (820×1000)", width: 820, height: 1000 },
  { key: "desktop", label: "PC (1280×800)", width: 1280, height: 800 },
] as const;

type ViewportKey = (typeof VIEWPORTS)[number]["key"];

function loadRuns(): SavedRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedRun[]) : [];
  } catch {
    return [];
  }
}

function persistRuns(runs: SavedRun[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runs));
  } catch {
    /* 容量超過などは無視 */
  }
}

function fmt(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "-";
  return n.toFixed(digits);
}

const SHOP_COUNTS = [
  { key: "real", label: "実データのまま", param: "" },
  { key: "300", label: "300 店舗（本番規模）", param: "&perfShops=300" },
  { key: "600", label: "600 店舗（負荷テスト）", param: "&perfShops=600" },
] as const;

type ShopCountKey = (typeof SHOP_COUNTS)[number]["key"];

/** ズーム段階の合計（全ステップの合算で 1 行にまとめる） */
function sumZoom(report: BenchmarkReport) {
  const steps = report.zoomSteps;
  return {
    maxMarkerPaneElements: steps.reduce((m, z) => Math.max(m, z.markerPaneElements), report.dom.markerPaneElements),
    maxMarkerCount: steps.reduce((m, z) => Math.max(m, z.markerCount), report.dom.markerCount),
    droppedFrames: steps.reduce((s, z) => s + z.droppedFrames, 0),
    maxMs: steps.reduce((m, z) => Math.max(m, z.maxMs), 0),
    longTaskMs: steps.reduce((s, z) => s + z.longTaskMs, 0),
    avgZoomEndMs: steps.length ? steps.reduce((s, z) => s + z.zoomEndMs, 0) / steps.length : 0,
    p95Ms: steps.length ? Math.max(...steps.map((z) => z.p95Ms)) : 0,
  };
}

/** 比較表の 1 行。小さいほど良い指標なので、改善率は (before - after) / before */
interface MetricRow {
  label: string;
  unit: string;
  pick: (r: BenchmarkReport) => number | null;
  digits?: number;
}

const METRICS: MetricRow[] = [
  { label: "マーカーペインの DOM 要素数（最大）", unit: "個", pick: (r) => sumZoom(r).maxMarkerPaneElements, digits: 0 },
  { label: "1 マーカーあたりの要素数", unit: "個", pick: (r) => r.dom.elementsPerMarker },
  { label: "JS ヒープ", unit: "MB", pick: (r) => r.dom.jsHeapMb },
  { label: "アイドル時の最長フレーム", unit: "ms", pick: (r) => r.idle.maxMs },
  { label: "ズーム中のコマ落ち（合計）", unit: "フレーム", pick: (r) => sumZoom(r).droppedFrames, digits: 0 },
  { label: "ズーム中の最長フレーム", unit: "ms", pick: (r) => sumZoom(r).maxMs },
  { label: "ズーム中の p95 フレーム", unit: "ms", pick: (r) => sumZoom(r).p95Ms },
  { label: "ズーム中のロングタスク（合計）", unit: "ms", pick: (r) => sumZoom(r).longTaskMs },
  { label: "ズーム完了までの平均時間", unit: "ms", pick: (r) => sumZoom(r).avgZoomEndMs },
  { label: "パン中のコマ落ち", unit: "フレーム", pick: (r) => r.pan.droppedFrames, digits: 0 },
  { label: "パン中の最長フレーム", unit: "ms", pick: (r) => r.pan.maxMs },
  { label: "一斉ハイライト: 同期コスト", unit: "ms", pick: (r) => r.highlight.applySyncMs },
  { label: "一斉ハイライト: 描画完了まで", unit: "ms", pick: (r) => r.highlight.applyPaintMs },
  { label: "ハイライト解除: 描画完了まで", unit: "ms", pick: (r) => r.highlight.clearPaintMs },
];

function FrameStatsCells({ s }: { s: FrameStats }) {
  return (
    <>
      <td className="px-3 py-2 text-right tabular-nums">{s.frames}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.avgMs)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.p95Ms)}</td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.maxMs)}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${s.droppedFrames > 0 ? "text-red-600 font-semibold" : ""}`}>
        {s.droppedFrames}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{fmt(s.longTaskMs, 0)}</td>
    </>
  );
}

export default function MapPerfClient() {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [viewport, setViewport] = useState<ViewportKey>("phone");
  const [shopCount, setShopCount] = useState<ShopCountKey>("300");
  const [frameKey, setFrameKey] = useState(0);
  const [ready, setReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<BenchmarkReport | null>(null);
  const [label, setLabel] = useState("");
  const [runs, setRuns] = useState<SavedRun[]>([]);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  useEffect(() => {
    const saved = loadRuns();
    setRuns(saved);
    if (saved.length >= 2) {
      setCompareA(saved[saved.length - 2].id);
      setCompareB(saved[saved.length - 1].id);
    }
  }, []);

  const vp = useMemo(() => VIEWPORTS.find((v) => v.key === viewport) ?? VIEWPORTS[0], [viewport]);
  const iframeSrc = useMemo(() => {
    const sc = SHOP_COUNTS.find((s) => s.key === shopCount) ?? SHOP_COUNTS[0];
    return `/map?perf=1${sc.param}`;
  }, [shopCount]);

  const getBench = useCallback((): NicchyoMapBench | null => {
    const win = iframeRef.current?.contentWindow as (Window & { __nicchyoMapBench?: NicchyoMapBench }) | null;
    return win?.__nicchyoMapBench ?? null;
  }, []);

  // iframe 側が準備できたら ready にする（ポーリング。同一オリジンなので直接覗ける）
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

  const reload = () => {
    setLatest(null);
    setError(null);
    setFrameKey((k) => k + 1);
  };

  const run = async () => {
    const bench = getBench();
    if (!bench) {
      setError("マップの準備ができていません。少し待ってから再実行してください。");
      return;
    }
    setRunning(true);
    setError(null);
    setProgress("開始");
    try {
      // ローディング演出が残っていると数字が汚れるので、少し置いてから走らせる
      await new Promise((r) => setTimeout(r, 800));
      const report = await bench.run((p) => setProgress(p));
      setLatest(report);
      setProgress("完了");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  };

  const save = () => {
    if (!latest) return;
    const entry: SavedRun = {
      id: `${Date.now()}`,
      label: label.trim() || `計測 ${new Date(latest.ranAt).toLocaleString("ja-JP")}`,
      report: latest,
    };
    const next = [...runs, entry];
    setRuns(next);
    persistRuns(next);
    setLabel("");
    if (runs.length >= 1) {
      setCompareA(runs[runs.length - 1].id);
      setCompareB(entry.id);
    }
  };

  const remove = (id: string) => {
    const next = runs.filter((r) => r.id !== id);
    setRuns(next);
    persistRuns(next);
  };

  const runA = runs.find((r) => r.id === compareA) ?? null;
  const runB = runs.find((r) => r.id === compareB) ?? null;

  return (
    <div className="space-y-8">
      {/* 操作 */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-700">画面サイズ</label>
          <select
            value={viewport}
            onChange={(e) => {
              setViewport(e.target.value as ViewportKey);
              reload();
            }}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm"
            disabled={running}
          >
            {VIEWPORTS.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
          <label className="text-sm font-medium text-slate-700">店舗数</label>
          <select
            value={shopCount}
            onChange={(e) => {
              setShopCount(e.target.value as ShopCountKey);
              reload();
            }}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm"
            disabled={running}
          >
            {SHOP_COUNTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={reload}
            disabled={running}
            className="rounded-full border border-slate-300 px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            マップを再読込
          </button>
          <button
            type="button"
            onClick={run}
            disabled={!ready || running}
            className="rounded-full bg-nicchyo-primary px-5 py-1.5 text-sm font-semibold text-nicchyo-ink shadow hover:brightness-95 disabled:opacity-50"
          >
            {running ? "計測中…" : "計測を実行"}
          </button>
          <span className="text-sm text-slate-500">
            {ready ? (running ? progress : "準備完了") : "マップを読み込み中…"}
          </span>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <p className="mt-3 text-xs text-slate-500">
          計測中はこのタブを前面にしたまま触らないでください。バックグラウンドではフレームが止まり、数値が意味を持たなくなります。
          端末やブラウザの状態で数字は揺れるので、同じ条件で 2〜3 回取って傾向を見るのがおすすめです。
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

      {/* 直近の結果 */}
      {latest && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-800">今回の結果</h2>
            <div className="flex items-center gap-2">
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="ラベル（例: 変更前 / SVG 化後）"
                className="rounded-full border border-slate-300 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={save}
                className="rounded-full bg-slate-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                保存して比較に使う
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="マーカー数" value={String(latest.dom.markerCount)} />
            <Stat label="マーカー DOM 要素" value={String(latest.dom.markerPaneElements)} />
            <Stat label="1 マーカーあたり" value={fmt(latest.dom.elementsPerMarker)} />
            <Stat label="ページ全体の要素" value={String(latest.dom.documentElements)} />
            <Stat label="JS ヒープ" value={latest.dom.jsHeapMb === null ? "-" : `${fmt(latest.dom.jsHeapMb)} MB`} />
          </div>

          <div className="overflow-x-auto">
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
                  <FrameStatsCells s={latest.idle} />
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {latest.dom.markerCount} / {latest.dom.markerPaneElements}
                  </td>
                </tr>
                {latest.zoomSteps.map((z, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      ズーム {z.fromZoom} → {z.toZoom}
                    </td>
                    <FrameStatsCells s={z} />
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(z.zoomEndMs, 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {z.markerCount} / {z.markerPaneElements}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-slate-100">
                  <td className="px-3 py-2">パン</td>
                  <FrameStatsCells s={latest.pan} />
                  <td className="px-3 py-2 text-right">-</td>
                  <td className="px-3 py-2 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="一斉ハイライト: 同期" value={`${fmt(latest.highlight.applySyncMs)} ms`} sub={`${latest.highlight.markers} マーカー`} />
            <Stat label="一斉ハイライト: 描画完了" value={`${fmt(latest.highlight.applyPaintMs)} ms`} />
            <Stat label="解除: 同期" value={`${fmt(latest.highlight.clearSyncMs)} ms`} />
            <Stat label="解除: 描画完了" value={`${fmt(latest.highlight.clearPaintMs)} ms`} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {latest.viewport.width}×{latest.viewport.height} / DPR {latest.viewport.dpr} / {latest.userAgent}
          </p>
        </section>
      )}

      {/* 比較 */}
      {runs.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-800">保存した結果を比較</h2>
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <RunSelect label="A（変更前）" value={compareA} onChange={setCompareA} runs={runs} />
            <span className="text-slate-400">→</span>
            <RunSelect label="B（変更後）" value={compareB} onChange={setCompareB} runs={runs} />
          </div>
          {runA && runB ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2">指標（小さいほど良い）</th>
                    <th className="px-3 py-2 text-right">{runA.label}</th>
                    <th className="px-3 py-2 text-right">{runB.label}</th>
                    <th className="px-3 py-2 text-right">改善率</th>
                  </tr>
                </thead>
                <tbody>
                  {METRICS.map((m) => {
                    const a = m.pick(runA.report);
                    const b = m.pick(runB.report);
                    const ratio = a !== null && b !== null && a > 0 ? (a - b) / a : null;
                    const tone =
                      ratio === null || Math.abs(ratio) < 0.05
                        ? "text-slate-500"
                        : ratio > 0
                          ? "text-emerald-600 font-semibold"
                          : "text-red-600 font-semibold";
                    return (
                      <tr key={m.label} className="border-b border-slate-100">
                        <td className="px-3 py-2">{m.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(a, m.digits)} {m.unit}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {fmt(b, m.digits)} {m.unit}
                        </td>
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
            <p className="text-sm text-slate-500">比較する 2 つの結果を選んでください。</p>
          )}

          <ul className="mt-5 space-y-1 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>
                  <span className="font-medium text-slate-800">{r.label}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {new Date(r.report.ranAt).toLocaleString("ja-JP")} / {r.report.viewport.width}×{r.report.viewport.height}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="text-xs text-slate-400 hover:text-red-600"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-bold tabular-nums text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function RunSelect({
  label,
  value,
  onChange,
  runs,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  runs: SavedRun[];
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-slate-600">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-full border border-slate-300 bg-white px-3 py-1.5"
      >
        <option value="">選択</option>
        {runs.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
