import { METRICS } from "@/scripts/code-health/rules.mjs";
import { statusOf, type MetricStatus } from "@/lib/code-health/status";
import type { MetricComparison } from "@/lib/code-health/compareSnapshots";

export interface MetricTilesProps {
  metrics: Record<string, number>;
  comparison: MetricComparison[] | null;
}

const STATUS_LABEL: Record<MetricStatus, string> = {
  good: "目標内",
  warning: "もう少し",
  critical: "要改善",
};

const STATUS_CLASS: Record<MetricStatus, string> = {
  good: "bg-status-good-bg text-status-good-fg ring-status-good-line",
  warning: "bg-status-warning-bg text-status-warning-fg ring-status-warning-line",
  critical: "bg-status-critical-bg text-status-critical-fg ring-status-critical-line",
};

function unitText(value: number, unit: string): string {
  return unit === "%" ? `${value}%` : `${value}${unit}`;
}

export function MetricTiles({ metrics, comparison }: MetricTilesProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {METRICS.map((metric) => {
        const value = metrics[metric.id] ?? 0;
        const status = statusOf({ better: metric.better as "lower" | "higher", target: metric.target }, value);
        const delta = comparison?.find((c) => c.id === metric.id);
        return (
          <article key={metric.id} className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
            <h3 className="text-sm font-semibold text-nicchyo-ink">{metric.label}</h3>
            <p className="mt-1 text-2xl font-bold tabular-nums text-nicchyo-ink">
              {unitText(value, metric.unit)}
            </p>
            <p className="mt-1 text-xs text-nicchyo-ink/55">
              目標 {metric.better === "lower" ? "≤" : "≥"} {unitText(metric.target, metric.unit)}
            </p>
            <span
              className={`mt-2 inline-flex items-center gap-1 rounded-chip px-2 py-0.5 text-xs font-semibold ring-1 ${STATUS_CLASS[status]}`}
            >
              {STATUS_LABEL[status]}
            </span>
            {delta && delta.direction !== "same" ? (
              <p
                className={`mt-2 text-xs tabular-nums ${
                  delta.direction === "better" ? "text-status-good-fg" : "text-status-critical-fg"
                }`}
              >
                前回比 {delta.direction === "better" ? "改善" : "悪化"}（
                {unitText(delta.before, metric.unit)} → {unitText(delta.after, metric.unit)}）
              </p>
            ) : null}
            <p className="mt-2 text-xs text-nicchyo-ink/40">{metric.why}</p>
          </article>
        );
      })}
    </div>
  );
}
