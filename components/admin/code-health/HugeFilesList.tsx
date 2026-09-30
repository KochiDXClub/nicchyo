import { ROLES } from "@/scripts/code-health/rules.mjs";
import { EmptyMessage } from "@/components/ui";
import type { LargeFile } from "@/lib/code-health/types";

export interface HugeFilesListProps {
  largeFiles: LargeFile[];
}

const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.id, r.label]));

export function HugeFilesList({ largeFiles }: HugeFilesListProps) {
  return (
    <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <h2 className="text-sm font-semibold text-nicchyo-ink">巨大ファイル（600行超）</h2>
      {largeFiles.length === 0 ? (
        <EmptyMessage className="mt-3" message="該当するファイルはありません" padding="py-4" />
      ) : (
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-sm">
          {largeFiles.map((f) => (
            <li key={f.path} className="flex items-center justify-between gap-4 border-b border-line py-1.5 last:border-0">
              <span className="truncate text-nicchyo-ink">{f.path}</span>
              <span className="shrink-0 text-xs text-nicchyo-ink/55 tabular-nums">
                {f.lines.toLocaleString()}行 ・ {ROLE_LABEL[f.role] ?? f.role}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
