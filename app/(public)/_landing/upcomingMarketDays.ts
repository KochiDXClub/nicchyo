import { getMarketCalendarDates, PUBLIC_CALENDAR_WEEKS, type MarketCalendar, type MarketDayStatus } from "@/lib/market/calendar";
import type { Locale } from "@/lib/i18n/config";

/** 「これからの日曜」の1枚分 */
export type LandingMarketDay = {
  dateIso: string;
  month: number;
  day: number;
  marketId: string;
  marketName?: string;
  /** 開催カレンダーに登録された状態。開催曜日の未登録日は通常開催。 */
  status: MarketDayStatus;
};

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/** 月の表示。日本語は「11月」、英語は「Nov」のように短く出す（カレンダーの札に収まる形） */
export function monthLabel(month: number, locale: Locale): string {
  return locale === "en" ? (EN_MONTHS[month - 1] ?? String(month)) : `${month}月`;
}

/** 開催しない日（荒天中止・臨時休市）か。クライアントの部品からも読まれるので、サーバー専用の処理を持つファイルには置かない */
export function isOff(status: LandingMarketDay["status"]) {
  return status === "cancelled" || status === "closed";
}

export function buildLandingMarketDays(calendar: MarketCalendar): LandingMarketDay[] {
  return getMarketCalendarDates(calendar, PUBLIC_CALENDAR_WEEKS.landing, { includeEventDates: false }).flatMap((entry) => {
    if (!entry.status) return [];
    return [toLandingMarketDay(entry)];
  });
}

export function toLandingMarketDay({ dateIso, marketId, marketName, status }: {
  dateIso: string;
  marketId: string;
  marketName?: string;
  status: MarketDayStatus | null;
}): LandingMarketDay {
  const [, month, day] = dateIso.split("-").map(Number);
  return { dateIso, month, day, marketId, marketName, status: status ?? "open" };
}
