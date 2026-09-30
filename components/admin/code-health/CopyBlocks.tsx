import { EmptyMessage } from "@/components/ui";
import type { CloneBlock } from "@/lib/code-health/types";

export interface CopyBlocksProps {
  clones: CloneBlock[];
}

const MAX_VISIBLE = 30;

export function CopyBlocks({ clones }: CopyBlocksProps) {
  const visible = clones.slice(0, MAX_VISIBLE);
  return (
    <section className="rounded-card bg-white p-4 shadow-card ring-1 ring-line">
      <h2 className="text-sm font-semibold text-nicchyo-ink">コピペのまとまり</h2>
      {visible.length === 0 ? (
        <EmptyMessage className="mt-3" message="検出されたコピペはありません" padding="py-4" />
      ) : (
        <>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-nicchyo-ink/55">
                  <th className="py-2 pr-4 font-medium">ファイルA</th>
                  <th className="py-2 pr-4 font-medium">ファイルB</th>
                  <th className="py-2 pr-4 text-right font-medium">行数</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="py-2 pr-4 truncate text-nicchyo-ink">
                      {c.a.path}:{c.a.start}-{c.a.end}
                    </td>
                    <td className="py-2 pr-4 truncate text-nicchyo-ink">
                      {c.b.path}:{c.b.start}-{c.b.end}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">{c.lines}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {clones.length > MAX_VISIBLE ? (
            <p className="mt-2 text-xs text-nicchyo-ink/55">
              他 {clones.length - MAX_VISIBLE} 件（行数が多い順に上位{MAX_VISIBLE}件のみ表示）
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
