import { EmptyMessage } from "@/components/ui";
import type { SameNameGroup } from "@/lib/code-health/types";

export interface DuplicateNamesProps {
  groups: SameNameGroup[];
}

export function DuplicateNames({ groups }: DuplicateNamesProps) {
  return (
    <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <h2 className="text-sm font-semibold text-nicchyo-ink">同じ名前の部品が別々の場所にある</h2>
      {groups.length === 0 ? (
        <EmptyMessage className="mt-3" message="該当する部品はありません" padding="py-4" />
      ) : (
        <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto text-sm">
          {groups.map((g) => (
            <li key={g.name}>
              <p className="font-medium text-nicchyo-ink">{g.name}</p>
              <ul className="mt-1 space-y-0.5 pl-3 text-xs text-nicchyo-ink/55">
                {g.paths.map((p) => (
                  <li key={p} className="truncate">
                    {p}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
