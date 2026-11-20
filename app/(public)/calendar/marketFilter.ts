import type { MarketCalendarDate } from "@/lib/market/calendar";

/** 絞り込みのチップに出す市 */
export type MarketOption = { id: string; name: string };

function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00Z`).getUTCDay();
}

/**
 * 一覧に出てくる市を、開催曜日の順（日→土）で返す。
 * 日曜市だけのときは市の名前を持たないので空になり、チップは出さない。
 * 週ごとに並びが入れ替わらないよう、近い順ではなく曜日順にする。
 */
export function listMarketOptions(dates: readonly MarketCalendarDate[]): MarketOption[] {
  const options = new Map<string, MarketOption & { weekday: number }>();
  for (const date of dates) {
    if (!date.marketName || options.has(date.marketId)) continue;
    options.set(date.marketId, { id: date.marketId, name: date.marketName, weekday: weekdayOf(date.dateIso) });
  }
  return [...options.values()]
    .sort((a, b) => a.weekday - b.weekday)
    .map(({ id, name }) => ({ id, name }));
}

/** 選んだ市の日だけにする。null は「すべて」 */
export function filterDatesByMarket(
  dates: readonly MarketCalendarDate[],
  marketId: string | null
): MarketCalendarDate[] {
  return marketId ? dates.filter((date) => date.marketId === marketId) : [...dates];
}

/** 一番近い開催日（イベントだけの日は除く） */
export function findNextMarketDate(dates: readonly MarketCalendarDate[]): MarketCalendarDate | null {
  return dates.find((date) => date.status !== null) ?? null;
}
