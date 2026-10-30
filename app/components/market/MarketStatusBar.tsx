import Link from "next/link";
import {
  formatEventDate,
  getStatusPresentation,
  getUpcomingSundayIso,
  shouldSurfaceOnMap,
  type MarketDay,
} from "@/lib/market/calendar";

type Placement = "map" | "page" | "hero";

type Props = {
  /** market_days の該当行。未登録なら null（＝通常どおり開催の想定） */
  day: MarketDay | null;
  /**
   * map … 例外（中止・臨時休市・特別開催）のときだけ出す。
   *        平常時まで常設すると検索バーを押し下げるだけのノイズになるため。
   * page … 常に出す（近況ページ・カレンダーページの最上部）。
   * hero … 常に出す。トップの広い画面で右に置く、縦長のカード。
   */
  placement: Placement;
  className?: string;
};

const TONE_CLASS = {
  neutral: "bg-white text-nicchyo-ink ring-1 ring-black/5",
  alert: "bg-rose-500 text-white",
  highlight: "bg-nicchyo-accent text-nicchyo-ink",
} as const;

/**
 * 「今週の日曜市：開催 / 荒天中止」を1行で伝えるバー。
 * 日曜市カレンダー（docs/discussion-market-calendar.md）で最も重要な導線。
 */
export default function MarketStatusBar({ day, placement, className = "" }: Props) {
  const status = day?.status ?? "open";

  // マップでは平常時に出さない。ステータス未登録（null）も平常扱い。
  if (placement === "map" && !shouldSurfaceOnMap(status)) return null;

  const { label, tone } = getStatusPresentation(status);
  const dateLabel = formatEventDate(day?.market_date ?? getUpcomingSundayIso());

  if (placement === "hero") {
    return (
      <Link
        href="/calendar"
        prefetch={false}
        className={`flex flex-col gap-3 rounded-card p-5 shadow-float transition hover:-translate-y-0.5 ${TONE_CLASS[tone]} ${className}`}
      >
        <span className="text-xs font-bold opacity-60">今週の日曜市</span>
        <span className="text-3xl font-black leading-tight">{dateLabel}</span>
        <span
          className={`self-start rounded-full px-3 py-1 text-sm font-bold ${
            tone === "neutral" ? "bg-nicchyo-primary/15 text-nicchyo-ink" : "bg-black/15"
          }`}
        >
          {label}
        </span>
        {day?.note && <span className="text-sm opacity-90">{day.note}</span>}
        <span className="mt-1 flex items-center gap-1 border-t border-black/10 pt-3 text-sm font-bold">
          開催カレンダーを見る
          <svg className="h-4 w-4 opacity-60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </Link>
    );
  }

  return (
    <Link
      href="/calendar"
      prefetch={false}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] shadow-sm transition active:scale-[0.99] ${TONE_CLASS[tone]} ${className}`}
    >
      <span className="shrink-0 font-bold">{dateLabel}</span>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
          tone === "neutral" ? "bg-nicchyo-primary/15 text-nicchyo-ink" : "bg-black/15"
        }`}
      >
        {label}
      </span>
      {day?.note && <span className="truncate opacity-90">{day.note}</span>}
      <svg
        className="ml-auto h-4 w-4 shrink-0 opacity-50"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
