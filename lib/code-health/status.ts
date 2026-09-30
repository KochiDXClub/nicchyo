// 指標値の良否判定。scripts/code-health/report-html.mjs の statusOf() と同じ考え方
// （目標の2倍以上 lower / 半分未満 higher で「要改善」）。

export type MetricStatus = "good" | "warning" | "critical";

export interface MetricLike {
  better: "lower" | "higher";
  target: number;
}

export function statusOf(metric: MetricLike, value: number): MetricStatus {
  const ok = metric.better === "lower" ? value <= metric.target : value >= metric.target;
  if (ok) return "good";
  const ratio = value / Math.max(metric.target, 1);
  const far = metric.better === "lower" ? ratio > 2 : ratio < 0.5;
  return far ? "critical" : "warning";
}
