import { getUpcomingSundayIso, normalizeStatus, type MarketDay, type MarketDayStatus } from "@/lib/market/calendar";

/** 「これからの日曜」の1枚分 */
export type LandingSunday = {
  dateIso: string;
  month: number;
  day: number;
  /** 開催カレンダーに登録された状態。未登録の日曜は「開催」として出す（カレンダーと同じ扱い） */
  status: MarketDayStatus;
};

/** 日曜を何週ぶん出すか */
export const LANDING_SUNDAY_COUNT = 8;

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * 今週の日曜から count 週ぶんの日曜を、開催カレンダー（market_days）の状態つきで並べる。
 * 日付は JST の暦日で決める（lib/market/calendar の getUpcomingSundayIso と同じ）
 */
export function buildLandingSundays(days: MarketDay[], now: Date = new Date(), count: number = LANDING_SUNDAY_COUNT): LandingSunday[] {
  const statusByDate = new Map(days.map((day) => [day.market_date, normalizeStatus(day.status)]));
  const first = getUpcomingSundayIso(now);
  return Array.from({ length: count }, (_, index) => {
    const dateIso = addDays(first, index * 7);
    const [, month, day] = dateIso.split("-").map(Number);
    return { dateIso, month, day, status: statusByDate.get(dateIso) ?? "open" };
  });
}
