import { cn } from "@/lib/utils/cn";
import type { Locale } from "@/lib/i18n/config";
import type { Translate } from "@/lib/i18n/translate";
import { getStatusPresentation } from "@/lib/market/calendar";
import { isOff, monthLabel, type LandingMarketDay } from "./upcomingMarketDays";
import "./landing.css";

/** 日めくりカレンダーに出す、言語に合わせた文字列（呼び出し側で作って渡す） */
export type NextSundayCalendarText = {
  /** 月の見出し（「11月」 / "Nov"） */
  monthText: string;
  /** 曜日の見出し（「日曜日」 / "Sunday"） */
  weekdayText: string;
  /** 開催状態のチップ（「開催」 / "Open" など） */
  statusText: string;
  marketName?: string;
  /** 読み上げ用の文（「次の日曜市は11月8日、開催」） */
  ariaText: string;
};

/**
 * NextSundayCalendar に渡す文字列を組み立てる。
 * この部品はサーバー・クライアントどちらからも使うため、ここでは
 * `getT()`（next/headers）を読まず、呼び出し側が持っている t と locale で作る。
 */
export function nextSundayCalendarText(next: LandingMarketDay, t: Translate, locale: Locale, statusLabel = getStatusPresentation(next.status).label): NextSundayCalendarText {
  const statusText = t(statusLabel);
  const dateLabel = locale === "en" ? `${monthLabel(next.month, locale)} ${next.day}` : `${next.month}月${next.day}日`;
  return {
    monthText: monthLabel(next.month, locale),
    weekdayText: next.marketName || new Date(next.dateIso).getUTCDay() !== 0
      ? new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(next.dateIso))
      : t("日曜日"),
    statusText,
    ariaText: next.marketName
      ? t("{market}は{date}、{status}").replace("{market}", t(next.marketName)).replace("{date}", dateLabel).replace("{status}", statusText)
      : t("次の日曜市は{date}、{status}").replace("{date}", dateLabel).replace("{status}", statusText),
    marketName: next.marketName ? t(next.marketName) : undefined,
  };
}

/**
 * 日めくりカレンダー（次の日曜）。後ろに2枚重ねる。
 * 「次の日曜市は、いつ？」と、PCのトップの写真の上で同じ見た目を使う。
 * 文字列は text で受け取る（サーバー専用の処理を持ち込まないため）
 */
export default function NextSundayCalendar({
  marketDay: next,
  className,
  text,
}: {
  marketDay: LandingMarketDay;
  className?: string;
  text: NextSundayCalendarText;
}) {
  return (
    <div className={cn("relative mx-auto h-[15.6rem] w-[14.4rem]", className)} role="img" aria-label={text.ariaText}>
      <span aria-hidden className="absolute inset-0 -translate-x-2 translate-y-1.5 -rotate-[5deg] rounded-card bg-white shadow-chip ring-1 ring-line-warm" />
      <span aria-hidden className="absolute inset-0 translate-x-2 translate-y-2 rotate-[5deg] rounded-card bg-nicchyo-accent/30 shadow-chip" />
      <span className="landing-cal-page absolute inset-0 flex flex-col items-center overflow-hidden rounded-card bg-white pt-3.5 shadow-lift">
        <span aria-hidden className="landing-cal-rings absolute -top-1.5 inset-x-0 z-[2] flex justify-center gap-11">
          <i /><i /><i />
        </span>
        <span className="landing-cal-head absolute inset-x-0 top-0 h-[3.6rem] bg-amber-400" />
        <span className="relative z-[1] mt-2 text-xl font-black tracking-widest text-white">{text.monthText}</span>
        <span className="mt-5 font-display text-[6.5rem] leading-none text-nicchyo-ink">{next.day}</span>
        <span className="mt-1 flex max-w-full items-baseline gap-2 px-3 text-[17px] font-black text-amber-700">
          {text.weekdayText && <span className="shrink-0">{text.weekdayText}</span>}
          {text.marketName && <span className="truncate text-sm">{text.marketName}</span>}
        </span>
        <span
          className={cn(
            "mt-2.5 rounded-chip border px-[18px] py-0.5 text-sm font-black",
            isOff(next.status) ? "border-line bg-nicchyo-ink/5 text-nicchyo-ink/55" : "border-lime-300 bg-lime-100 text-green-800"
          )}
        >
          {text.statusText}
        </span>
      </span>
    </div>
  );
}
