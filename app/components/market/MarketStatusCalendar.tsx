"use client";

import Link from "next/link";
import NextSundayCalendar, { nextSundayCalendarText } from "@/app/(public)/_landing/NextSundayCalendar";
import { toLandingMarketDay } from "@/app/(public)/_landing/upcomingMarketDays";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { getStatusPresentation, type MarketCalendarDate } from "@/lib/market/calendar";

// 日めくりカレンダーは本体（14.4rem × 15.6rem）を scale-[0.52] で小さく出し、
// 囲みの横 7.6rem × 縦 8.2rem は本体 × 0.52 の目安に合わせている
type Props = {
  date: MarketCalendarDate;
  unregisteredLabel?: string;
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
export default function MarketStatusCalendar({ date, className = "", link = true, showSummary = true, unregisteredLabel }: Props) {
  const t = useT();
  const locale = useLocale();

  const { day, dateLabel, marketName, status } = date;
  if (!status) return null;
  const { label, tone } = getStatusPresentation(status);
  const marketDay = toLandingMarketDay(date);
  const statusLabel = !day && unregisteredLabel ? unregisteredLabel : label;
  const baseText = nextSundayCalendarText(marketDay, t, locale, statusLabel);
  // 市の名前があるときは、曜日（「日曜日」）を重ねて書かない。「日曜市」だけで十分伝わる
  const text = marketDay.marketName ? { ...baseText, weekdayText: "" } : baseText;

  const calendar = (
    <span className="relative block h-[8.2rem] w-[7.6rem] shrink-0">
      <NextSundayCalendar marketDay={marketDay} text={text} className="origin-top-left scale-[0.52]" />
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
      {(showSummary || tone !== "neutral" || day?.note) && (
        <div className="min-w-0">
          {showSummary && (
            <>
              <p className="text-xs font-bold text-nicchyo-ink/55">{marketName ? t(marketName) : t("次の日曜市")}</p>
              {tone === "alert" || tone === "highlight" ? (
                <p
                  className={`mt-1 inline-block rounded-btn px-3 py-1.5 text-base font-black ${
                    tone === "alert" ? "bg-rose-500 text-white" : "bg-nicchyo-accent text-nicchyo-ink"
                  }`}
                >
                  <span className="whitespace-nowrap">{dateLabel}</span>{" "}
                  <span className="whitespace-nowrap">{t(statusLabel)}</span>
                </p>
              ) : (
                <p className="mt-0.5 text-base font-black text-nicchyo-ink">
                  <span className="whitespace-nowrap">{dateLabel}</span>{" "}
                  <span className="whitespace-nowrap">{t(label)}</span>
                </p>
              )}
            </>
          )}
          {!showSummary && tone !== "neutral" && (
            <p className={`inline-block rounded-btn px-3 py-1.5 text-sm font-black ${
              tone === "alert" ? "bg-rose-500 text-white" : "bg-nicchyo-accent text-nicchyo-ink"
            }`}>
              {t(label)}
            </p>
          )}
          {day?.note && <p className="mt-1 text-xs leading-relaxed text-nicchyo-ink/70">{day.note}</p>}
        </div>
      )}
    </div>
  );
}
