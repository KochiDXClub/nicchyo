"use client";

import { Fragment, useState } from "react";
import { RULES } from "@/scripts/code-health/rules.mjs";
import type { RuleComparison } from "@/lib/code-health/compareSnapshots";
import type { RuleSummary } from "@/lib/code-health/types";

export interface RulesTableProps {
  rules: Record<string, RuleSummary>;
  comparison: RuleComparison[] | null;
}

const TOP_FILES = 8;

export function RulesTable({ rules, comparison }: RulesTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <h2 className="text-sm font-semibold text-nicchyo-ink">デザイン・共通化ルール違反</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-nicchyo-ink/55">
              <th className="py-2 pr-4 font-medium">ルール</th>
              <th className="py-2 pr-4 font-medium">出典</th>
              <th className="py-2 pr-4 text-right font-medium">件数</th>
              <th className="py-2 pr-4 text-right font-medium">前回比</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((rule) => {
              const summary = rules[rule.id];
              const delta = comparison?.find((c) => c.id === rule.id);
              const isOpen = expanded === rule.id;
              return (
                <Fragment key={rule.id}>
                  <tr className="border-b border-line last:border-0">
                    <td className="py-2 pr-4">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : rule.id)}
                        disabled={!summary || summary.value === 0}
                        className="font-medium text-nicchyo-ink disabled:cursor-default disabled:text-nicchyo-ink/40"
                      >
                        {rule.label}
                      </button>
                      <p className="mt-0.5 text-xs text-nicchyo-ink/55">{rule.why}</p>
                    </td>
                    <td className="py-2 pr-4 text-xs text-nicchyo-ink/55">{rule.source}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{summary?.value ?? 0}</td>
                    <td className="py-2 pr-4 text-right text-xs tabular-nums">
                      {delta && delta.direction !== "same" ? (
                        <span
                          className={delta.direction === "better" ? "text-status-good-fg" : "text-status-critical-fg"}
                        >
                          {delta.before} → {delta.after}
                        </span>
                      ) : (
                        <span className="text-nicchyo-ink/40">変化なし</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && summary ? (
                    <tr className="border-b border-line last:border-0 bg-nicchyo-base/40">
                      <td colSpan={4} className="px-4 py-3">
                        <p className="text-xs font-medium text-nicchyo-ink/70">件数が多いファイル（上位{TOP_FILES}件）</p>
                        <ul className="mt-1 space-y-0.5 text-xs text-nicchyo-ink/70">
                          {summary.files.slice(0, TOP_FILES).map((f) => (
                            <li key={f.path} className="flex justify-between gap-4">
                              <span className="truncate">{f.path}</span>
                              <span className="tabular-nums">{f.count}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
