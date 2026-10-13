/**
 * 新着の件数を示す赤い丸のバッジ。0 以下のときは何も出さない。
 * サイドバーの項目とタブで同じ見た目にするため、ここに置く。
 */
export function CountBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold tabular-nums text-white"
      aria-label={label ? `${label} ${count}件` : `${count}件`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
