// 前回のスナップショットとの比較。目標値・良否の向き（better）は
// scripts/code-health/rules.mjs を単一の元にする（ここで数値を作り直さない）。

import { METRICS, RULES } from "@/scripts/code-health/rules.mjs";
import type { SnapshotSummary } from "./types";

export type ComparisonDirection = "better" | "worse" | "same";

export interface MetricComparison {
  id: string;
  label: string;
  unit: string;
  before: number;
  after: number;
  direction: ComparisonDirection;
}

export interface RuleComparison {
  id: string;
  label: string;
  before: number;
  after: number;
  direction: ComparisonDirection;
}

export interface SnapshotComparison {
  metrics: MetricComparison[];
  rules: RuleComparison[];
  filesDelta: number;
  linesDelta: number;
}

function directionOf(before: number, after: number, better: "lower" | "higher"): ComparisonDirection {
  if (before === after) return "same";
  const improved = better === "lower" ? after < before : after > before;
  return improved ? "better" : "worse";
}

/** previous が無ければ（初回のスナップショットなら）比較できないので null を返す */
export function compareSnapshots(
  previous: SnapshotSummary | null,
  latest: SnapshotSummary
): SnapshotComparison | null {
  if (!previous) return null;

  const metrics: MetricComparison[] = METRICS.map((m) => {
    const before = previous.metrics[m.id] ?? 0;
    const after = latest.metrics[m.id] ?? 0;
    const better = m.better as "lower" | "higher";
    return { id: m.id, label: m.label, unit: m.unit, before, after, direction: directionOf(before, after, better) };
  });

  const rules: RuleComparison[] = RULES.map((r) => {
    const before = previous.rules[r.id]?.value ?? 0;
    const after = latest.rules[r.id]?.value ?? 0;
    // ルール違反はどれも「少ないほうが良い」
    return { id: r.id, label: r.label, before, after, direction: directionOf(before, after, "lower") };
  });

  return {
    metrics,
    rules,
    filesDelta: latest.totals.files - previous.totals.files,
    linesDelta: latest.totals.lines - previous.totals.lines,
  };
}
