import { Surface } from "@/components/ui";
import { cn } from "@/lib/utils/cn";

export type ReviewStatTone = "default" | "good" | "warning" | "critical" | "info" | "muted";

const toneClass: Record<ReviewStatTone, string> = {
  default: "text-nicchyo-ink",
  good: "text-status-good-fg",
  warning: "text-status-warning-fg",
  critical: "text-status-critical-fg",
  info: "text-info-fg",
  muted: "text-nicchyo-ink/40",
};

export interface ReviewStat {
  label: string;
  value: number | string;
  tone?: ReviewStatTone;
}

/**
 * 一覧の上に並べる件数。投稿の確認・店舗管理のように「件数を見てから絞り込む」画面で使う。
 * 列数は件数に合わせて自動で決める（3〜5個を想定）。
 */
export function ReviewStats({ items, compact = false }: { items: readonly ReviewStat[]; compact?: boolean }) {
  return (
    <div
      className={cn("mb-6 grid gap-3 sm:gap-4", items.length === 3 ? "grid-cols-3" : items.length === 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4")}
    >
      {items.map((item, index) => (
        <Surface key={item.label} padding="sm" className={cn(compact && "flex items-center justify-between gap-2 sm:block", compact && items.length === 5 && index === 0 && "col-span-2 sm:col-span-1")}>
          <p className="text-xs text-nicchyo-ink/55 sm:text-sm">{item.label}</p>
          <p className={cn(!compact && "mt-1", compact && "sm:mt-1", "text-xl font-bold tabular-nums sm:text-2xl", toneClass[item.tone ?? "default"])}>
            {item.value}
          </p>
        </Surface>
      ))}
    </div>
  );
}
