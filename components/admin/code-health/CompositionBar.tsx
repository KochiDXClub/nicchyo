import { METRICS, ROLES } from "@/scripts/code-health/rules.mjs";
import type { RoleOrKindTotal } from "@/lib/code-health/types";

export interface CompositionBarProps {
  byRole: Record<string, RoleOrKindTotal>;
}

const VISIBLE_ROLES = ROLES.filter((r) => r.id !== "test" && r.id !== "other");
const SHARED_TARGET = METRICS.find((m) => m.id === "sharedRatio")?.target ?? 30;

export function CompositionBar({ byRole }: CompositionBarProps) {
  const total = VISIBLE_ROLES.reduce((sum, r) => sum + (byRole[r.id]?.lines ?? 0), 0) || 1;

  return (
    <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <h2 className="text-sm font-semibold text-nicchyo-ink">機能ごとの行数の内訳</h2>
      <div className="relative mt-3 h-6 overflow-hidden rounded-btn bg-nicchyo-base">
        <div className="flex h-full">
          {VISIBLE_ROLES.map((role) => {
            const lines = byRole[role.id]?.lines ?? 0;
            const pct = (lines / total) * 100;
            if (pct <= 0) return null;
            return (
              <div
                key={role.id}
                style={{ width: `${pct}%`, background: role.color }}
                title={`${role.label}: ${lines.toLocaleString()}行（${pct.toFixed(1)}%）`}
              />
            );
          })}
        </div>
        <div
          className="absolute inset-y-0 border-l-2 border-nicchyo-ink/40"
          style={{ left: `${SHARED_TARGET}%` }}
          title={`共通化の目標ライン（${SHARED_TARGET}%）`}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-nicchyo-ink/70">
        {VISIBLE_ROLES.map((role) => {
          const lines = byRole[role.id]?.lines ?? 0;
          const pct = (lines / total) * 100;
          return (
            <li key={role.id} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-chip"
                style={{ background: role.color }}
                aria-hidden="true"
              />
              {role.label}（{pct.toFixed(1)}%）
            </li>
          );
        })}
      </ul>
    </section>
  );
}
