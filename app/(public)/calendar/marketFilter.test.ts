import { describe, expect, it } from "vitest";
import type { MarketCalendarDate } from "@/lib/market/calendar";
import { filterDatesByMarket, findNextMarketDate, listMarketOptions } from "./marketFilter";

function date(marketId: string, dateIso: string, marketName?: string, status: MarketCalendarDate["status"] = "open"): MarketCalendarDate {
  return {
    marketId,
    marketName,
    dateIso,
    dateLabel: dateIso,
    relativeLabel: "",
    isThisWeek: false,
    day: null,
    highlight: null,
    events: [],
    status,
  };
}

describe("marketFilter", () => {
  it("日曜市だけ（市の名前なし）のときはチップを出さない", () => {
    expect(listMarketOptions([date("sun", "2026-11-22"), date("sun", "2026-11-29")])).toEqual([]);
  });

  it("市を曜日の順（日→土）に一度ずつ並べる", () => {
    const dates = [
      date("thu", "2026-11-19", "木曜市"),
      date("fri", "2026-11-20", "金曜市"),
      date("sun", "2026-11-22", "日曜市"),
      date("thu", "2026-11-26", "木曜市"),
    ];
    expect(listMarketOptions(dates)).toEqual([
      { id: "sun", name: "日曜市" },
      { id: "thu", name: "木曜市" },
      { id: "fri", name: "金曜市" },
    ]);
  });

  it("選んだ市の日だけにし、null ならすべて返す", () => {
    const dates = [date("thu", "2026-11-19", "木曜市"), date("sun", "2026-11-22", "日曜市")];
    expect(filterDatesByMarket(dates, "sun").map((d) => d.marketId)).toEqual(["sun"]);
    expect(filterDatesByMarket(dates, null)).toHaveLength(2);
  });

  it("次の開催日はイベントだけの日を飛ばす", () => {
    const dates = [date("sun", "2026-11-21", "日曜市", null), date("sun", "2026-11-22", "日曜市")];
    expect(findNextMarketDate(dates)?.dateIso).toBe("2026-11-22");
    expect(findNextMarketDate([])).toBeNull();
  });
});
