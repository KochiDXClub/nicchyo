"use client";

import Link from "next/link";
import NextSundayCalendar, { nextSundayCalendarText } from "@/app/(public)/_landing/NextSundayCalendar";
import type { LandingSunday } from "@/app/(public)/_landing/upcomingSundays";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import {
  formatEventDate,
  getStatusPresentation,
  getUpcomingSundayIso,
  normalizeStatus,
  type MarketDay,
} from "@/lib/market/calendar";

// 日めくりカレンダーは本体（14.4rem × 15.6rem）を scale-[0.52] で小さく出し、
// 囲みの横 7.6rem × 縦 8.2rem は本体 × 0.52 の目安に合わせている
type Props = {
  /** market_days の該当行。未登録なら null（＝通常どおり開催の想定） */
  day: MarketDay | null;
  className?: string;
  /** カレンダーページ自身など、リンクにしない場所では false */
  link?: boolean;
  /** カレンダーと重複する日付・開催状態の表示を省く */
  showSummary?: boolean;
};

/**
 * ページ最上部に出す「次の日曜市」の案内（LP と同じ日めくりカレンダー）。
 *
 * 以前は MarketStatusBar の placement="page" が担っていたが、日めくりカレンダーは
 * 文字列を props で受け取る形になり、ここで useT()/useLocale() から渡す。
 * 中止・休市は赤い帯、特別開催は黄色の地で目立たせる（以前のページ版と同じ扱い）。
 */
export default function MarketStatusCalendar({ day, className = "", link = true, showSummary = true }: Props) {
  const t = useT();
  const locale = useLocale();

  const status = day?.status ?? "open";
  const { label, tone } = getStatusPresentation(status);
  const dateIso = day?.market_date ?? getUpcomingSundayIso();
  const dateLabel = formatEventDate(dateIso);

  const [, month, dayOfMonth] = dateIso.split("-").map(Number);
  const sunday: LandingSunday = { dateIso, month, day: dayOfMonth, status: normalizeStatus(status) };
  const text = nextSundayCalendarText(sunday, t, locale);

  const calendar = (
    <span className="relative block h-[8.2rem] w-[7.6rem] shrink-0">
      <NextSundayCalendar sunday={sunday} text={text} className="origin-top-left scale-[0.52]" />
    </span>
  );

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {link ? (
        <Link
          href="/calendar"
          prefetch={false}
          aria-label={text.ariaText}
          className="shrink-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
        >
          {calendar}
        </Link>
      ) : (
        calendar
      )}
      {(showSummary || day?.note) && (
        <div className="min-w-0">
          {showSummary && (
            <>
              <p className="text-xs font-bold text-nicchyo-ink/55">{t("次の日曜市")}</p>
              {tone === "alert" || tone === "highlight" ? (
                <p
                  className={`mt-1 inline-block rounded-btn px-3 py-1.5 text-base font-black ${
                    tone === "alert" ? "bg-rose-500 text-white" : "bg-nicchyo-accent text-nicchyo-ink"
                  }`}
                >
                  {dateLabel} {t(label)}
                </p>
              ) : (
                <p className="mt-0.5 text-base font-black text-nicchyo-ink">
                  {dateLabel} {t(label)}
                </p>
              )}
            </>
          )}
          {day?.note && <p className="mt-1 text-xs leading-relaxed text-nicchyo-ink/70">{day.note}</p>}
        </div>
      )}
    </div>
  );
}
