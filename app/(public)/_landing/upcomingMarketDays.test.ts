import { describe, expect, it } from "vitest";
import { buildLandingMarketDays, monthLabel } from "./upcomingMarketDays";
import { toIsoDate, type MarketDay } from "@/lib/market/calendar";

function buildLandingSundays(days: MarketDay[], now: Date, count: number) {
  return buildLandingMarketDays({
    todayIso: toIsoDate(now),
    markets: [{ id: "sun", slug: "nichiyo", name: "日曜市", weekday: 0, days, events: [] }],
  }).slice(0, count);
}

// 2026-10-14（水）の昼。今週の日曜は 2026-10-18
const NOW = new Date("2026-10-14T03:00:00Z");

describe("buildLandingSundays", () => {
  it("今週の日曜から、7日ずつ count 週ぶん並べる", () => {
    const sundays = buildLandingSundays([], NOW, 4);
    expect(sundays.map((sunday) => sunday.dateIso)).toEqual(["2026-10-18", "2026-10-25", "2026-11-01", "2026-11-08"]);
    expect(sundays[2]).toMatchObject({ month: 11, day: 1 });
  });

  it("登録のない日曜は「開催」、登録のある日曜はその状態で出す", () => {
    const sundays = buildLandingSundays(
      [
        { market_date: "2026-11-08", status: "cancelled", note: null },
        { market_date: "2026-10-25", status: "special", note: null },
      ],
      NOW,
      4
    );
    expect(sundays.map((sunday) => sunday.status)).toEqual(["open", "special", "open", "cancelled"]);
  });

  it("月はロケールで出す（日本語は「11月」、英語は「Nov」）", () => {
    expect(monthLabel(11, "ja")).toBe("11月");
    expect(monthLabel(11, "en")).toBe("Nov");
    expect(monthLabel(1, "en")).toBe("Jan");
  });

  it("日曜の当日は、その日を先頭にする（JST）", () => {
    const sundayMorningJst = new Date("2026-10-17T22:30:00Z"); // JST 10/18 7:30
    expect(buildLandingSundays([], sundayMorningJst, 1)[0].dateIso).toBe("2026-10-18");
  });
});
