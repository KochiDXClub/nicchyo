/**
 * 一覧で行を選んだときに出る、一括操作の帯。選んだ件数と「解除」、操作ボタン（children）を並べる。
 */
export function BulkActionBar({
  count,
  unit = "件",
  onClear,
  children,
}: {
  count: number;
  unit?: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="一括操作"
      className="mb-4 flex flex-col gap-3 rounded-card bg-amber-50 p-3 ring-1 ring-amber-200 sm:flex-row sm:items-center sm:justify-between sm:p-4"
    >
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-nicchyo-ink">
          {count}
          {unit}選択中
        </span>
        <button type="button" onClick={onClear} className="text-sm text-amber-800 underline hover:no-underline">
          解除
        </button>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
