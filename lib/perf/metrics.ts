/**
 * 計測レポートから比較用の指標を取り出す
 *
 * 指標の定義はここが唯一の正。計測ページ（表・グラフ）、API、CLI の要約は
 * すべてこの定義を使う。DB には生のレポートしか持たないので、
 * ここに指標を足せば過去のログにもそのまま効く。
 */

import type { BenchmarkReport } from "./mapBenchmark";

export type MetricKey =
  | "domMarkerMax"
  | "domElementsMax"
  | "elementsPerMarker"
  | "jsHeapMb"
  | "idleMaxFrameMs"
  | "zoomDroppedFrames"
  | "zoomMaxFrameMs"
  | "zoomP95FrameMs"
  | "zoomLongTaskMs"
  | "zoomEndAvgMs"
  | "panDroppedFrames"
  | "panMaxFrameMs"
  | "highlightApplySyncMs"
  | "highlightApplyPaintMs"
  | "highlightClearPaintMs";

export interface MetricDef {
  key: MetricKey;
  label: string;
  unit: string;
  /** 表示桁数 */
  digits: number;
  /** グラフの既定候補として目立たせるか */
  primary?: boolean;
  pick: (r: BenchmarkReport) => number | null;
}

function zoomAgg(r: BenchmarkReport) {
  const steps = r.zoomSteps ?? [];
  const n = steps.length || 1;
  return {
    dropped: steps.reduce((s, z) => s + z.droppedFrames, 0),
    max: steps.reduce((m, z) => Math.max(m, z.maxMs), 0),
    p95: steps.reduce((m, z) => Math.max(m, z.p95Ms), 0),
    longTask: steps.reduce((s, z) => s + z.longTaskMs, 0),
    endAvg: steps.reduce((s, z) => s + z.zoomEndMs, 0) / n,
    markerMax: steps.reduce((m, z) => Math.max(m, z.markerCount ?? 0), r.dom.markerCount),
    elementsMax: steps.reduce(
      (m, z) => Math.max(m, z.markerPaneElements ?? 0),
      r.dom.markerPaneElements
    ),
  };
}

export const METRIC_DEFS: readonly MetricDef[] = [
  { key: "zoomEndAvgMs", label: "ズーム完了までの平均", unit: "ms", digits: 0, primary: true, pick: (r) => zoomAgg(r).endAvg },
  { key: "zoomDroppedFrames", label: "ズーム中のコマ落ち（合計）", unit: "フレーム", digits: 0, primary: true, pick: (r) => zoomAgg(r).dropped },
  { key: "zoomMaxFrameMs", label: "ズーム中の最長フレーム", unit: "ms", digits: 1, pick: (r) => zoomAgg(r).max },
  { key: "zoomP95FrameMs", label: "ズーム中の p95 フレーム", unit: "ms", digits: 1, pick: (r) => zoomAgg(r).p95 },
  { key: "zoomLongTaskMs", label: "ズーム中のロングタスク（合計）", unit: "ms", digits: 0, primary: true, pick: (r) => zoomAgg(r).longTask },
  { key: "panDroppedFrames", label: "パン中のコマ落ち", unit: "フレーム", digits: 0, pick: (r) => r.pan.droppedFrames },
  { key: "panMaxFrameMs", label: "パン中の最長フレーム", unit: "ms", digits: 1, pick: (r) => r.pan.maxMs },
  { key: "highlightApplyPaintMs", label: "一斉ハイライト: 描画完了まで", unit: "ms", digits: 1, primary: true, pick: (r) => r.highlight.applyPaintMs },
  { key: "highlightApplySyncMs", label: "一斉ハイライト: 同期コスト", unit: "ms", digits: 1, pick: (r) => r.highlight.applySyncMs },
  { key: "highlightClearPaintMs", label: "ハイライト解除: 描画完了まで", unit: "ms", digits: 1, pick: (r) => r.highlight.clearPaintMs },
  { key: "idleMaxFrameMs", label: "アイドル時の最長フレーム", unit: "ms", digits: 1, pick: (r) => r.idle.maxMs },
  { key: "domMarkerMax", label: "DOM 上のマーカー数（最大）", unit: "個", digits: 0, pick: (r) => zoomAgg(r).markerMax },
  { key: "domElementsMax", label: "マーカーペインの DOM 要素数（最大）", unit: "個", digits: 0, pick: (r) => zoomAgg(r).elementsMax },
  { key: "elementsPerMarker", label: "1 マーカーあたりの要素数", unit: "個", digits: 1, pick: (r) => r.dom.elementsPerMarker },
  { key: "jsHeapMb", label: "JS ヒープ", unit: "MB", digits: 1, pick: (r) => r.dom.jsHeapMb },
];

export type MetricValues = Record<MetricKey, number | null>;

export function computeMetrics(report: BenchmarkReport): MetricValues {
  const out = {} as MetricValues;
  for (const def of METRIC_DEFS) {
    let v: number | null = null;
    try {
      v = def.pick(report);
    } catch {
      v = null;
    }
    out[def.key] = v !== null && Number.isFinite(v) ? v : null;
  }
  return out;
}

export function formatMetric(value: number | null | undefined, def: MetricDef): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value.toFixed(def.digits)} ${def.unit}`;
}

/** 小さいほど良い指標なので、改善率は (before - after) / before */
export function improvementRatio(before: number | null, after: number | null): number | null {
  if (before === null || after === null || before <= 0) return null;
  return (before - after) / before;
}

export function median(values: number[]): number | null {
  const xs = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 === 1 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}
