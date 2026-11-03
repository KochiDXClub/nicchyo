import Link from "next/link";
import {
  formatEventDate,
  getStatusPresentation,
  getUpcomingSundayIso,
  shouldSurfaceOnMap,
  type MarketDay,
} from "@/lib/market/calendar";

type Props = {
  /** market_days の該当行。未登録なら null（＝通常どおり開催の想定） */
  day: MarketDay | null;
  className?: string;
};

const TONE_CLASS = {
  neutral: "bg-white text-nicchyo-ink ring-1 ring-black/5",
  alert: "bg-rose-500 text-white",
  highlight: "bg-nicchyo-accent text-nicchyo-ink",
} as const;

/**
 * 「今週の日曜市：開催 / 荒天中止」を1行で伝えるバー（マップ用）。
 * 日曜市カレンダー（docs/discussion-market-calendar.md）で最も重要な導線。
 * ページ最上部に出す日めくりカレンダー版は MarketStatusCalendar。
 * 例外（中止・臨時休市・特別開催）のときだけ出す。平常時まで常設すると
 * 検索バーを押し下げるだけのノイズになるため。
 */
export default function MarketStatusBar({ day, className = "" }: Props) {
  const status = day?.status ?? "open";

  // 平常時に出さない。ステータス未登録（null）も平常扱い。
  if (!shouldSurfaceOnMap(status)) return null;

  const { label, tone } = getStatusPresentation(status);
  const dateIso = day?.market_date ?? getUpcomingSundayIso();
  const dateLabel = formatEventDate(dateIso);

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
