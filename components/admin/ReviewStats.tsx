import { Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export type ReviewStatTone = "default" | "good" | "warning" | "muted";

const toneClass: Record<ReviewStatTone, string> = {
  default: "text-nicchyo-ink",
  good: "text-status-good-fg",
  warning: "text-status-warning-fg",
  muted: "text-nicchyo-ink/40",
};

export interface ReviewStat {
  label: string;
  value: number | string;
  tone?: ReviewStatTone;
}

/**
 * 一覧の上に並べる件数。投稿の確認・店舗管理のように「件数を見てから絞り込む」画面で使う。
 * 列数は件数に合わせて自動で決める（3〜4個を想定）。
 */
export function ReviewStats({ items }: { items: readonly ReviewStat[] }) {
  return (
    <div
      className={cn("mb-6 grid gap-3 sm:gap-4", items.length === 3 ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-4")}
    >
      {items.map((item) => (
        <Surface key={item.label} padding="sm">
          <p className="text-xs text-nicchyo-ink/55 sm:text-sm">{item.label}</p>
          <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", toneClass[item.tone ?? "default"])}>
            {item.value}
          </p>
        </Surface>
      ))}
    </div>
  );
}
