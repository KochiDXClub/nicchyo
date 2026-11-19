import { describe, expect, it } from "vitest";
import { jstWeekday, orderMarketsForToday, pickTodayMarket } from "./marketPick";

const markets = [
  { slug: "nichiyo", name: "日曜市", weekday: 0 },
  { slug: "kayo", name: "火曜市", weekday: 2 },
  { slug: "mokuyo", name: "木曜市", weekday: 4 },
];

describe("jstWeekday", () => {
  it("JST の曜日を返す（UTC の日付をまたぐ時刻も JST で判定）", () => {
    expect(jstWeekday(new Date("2026-11-18T14:59:00Z"))).toBe(3); // 水 23:59 JST
    expect(jstWeekday(new Date("2026-11-18T15:00:00Z"))).toBe(4); // 木 00:00 JST
    expect(jstWeekday(new Date("2026-11-21T15:00:00Z"))).toBe(0); // 日 00:00 JST
  });
});

describe("pickTodayMarket", () => {
  it("今日開催の市を返す。なければ null", () => {
    expect(pickTodayMarket(markets, new Date("2026-11-19T03:00:00Z"))?.slug).toBe("mokuyo"); // 木 12:00 JST
    expect(pickTodayMarket(markets, new Date("2026-11-18T03:00:00Z"))).toBeNull(); // 水
  });
});

describe("orderMarketsForToday", () => {
  it("今日の市を先頭に、そのあとは今日から先の曜日の順に並べる", () => {
    const thursday = new Date("2026-11-19T03:00:00Z");
    expect(orderMarketsForToday(markets, thursday).map((m) => m.slug)).toEqual(["mokuyo", "nichiyo", "kayo"]);
    const sunday = new Date("2026-11-22T03:00:00Z");
    expect(orderMarketsForToday(markets, sunday).map((m) => m.slug)).toEqual(["nichiyo", "kayo", "mokuyo"]);
  });

  it("元の配列を変えない", () => {
    const copy = [...markets];
    orderMarketsForToday(markets, new Date("2026-11-19T03:00:00Z"));
    expect(markets).toEqual(copy);
  });
});
