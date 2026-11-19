/**
 * 公開中の市を、今日の曜日（JST）から並べ替える。近況や相談が「今日の市」を先頭に出すために使う。
 * 曜日は 0=日〜6=土。市に同じ曜日がいくつあっても、先に来たものを使う。
 */

export type PickableMarket = {
  slug: string;
  name: string;
  weekday: number;
};

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 指定した時刻（省略時は現在）の JST での曜日（0=日〜6=土） */
export function jstWeekday(now: Date = new Date()): number {
  return new Date(now.getTime() + JST_OFFSET_MS).getUTCDay();
}

/** 今日開催の市（公開中のものの中で、今日の曜日に当たるもの）。なければ null */
export function pickTodayMarket<T extends PickableMarket>(markets: T[], now: Date = new Date()): T | null {
  const today = jstWeekday(now);
  return markets.find((market) => market.weekday === today) ?? null;
}

/**
 * 今日の市を先頭に、そのあとは今日から先の曜日の順に並べる。
 * 今日は開催しない市も、ほかの市の後ろに残す。
 */
export function orderMarketsForToday<T extends PickableMarket>(markets: T[], now: Date = new Date()): T[] {
  const today = jstWeekday(now);
  const distance = (market: T) => (market.weekday - today + 7) % 7;
  return [...markets].sort((a, b) => distance(a) - distance(b));
}
