import { describe, expect, it } from "vitest";
import { getUpcomingMarketDateIso, getUpcomingSundayIso } from "@/lib/market/calendar";

const jst = (iso: string) => new Date(iso);

describe("getUpcomingMarketDateIso", () => {
  it("木曜市（4）は、木曜の当日を含む次の木曜を返す", () => {
    expect(getUpcomingMarketDateIso(4, jst("2026-11-18T14:00:00Z"))).toBe("2026-11-19");
    expect(getUpcomingMarketDateIso(4, jst("2026-11-18T15:30:00Z"))).toBe("2026-11-19");
    expect(getUpcomingMarketDateIso(4, jst("2026-11-19T15:00:00Z"))).toBe("2026-11-26");
  });

  it("日曜（0）の結果は getUpcomingSundayIso と一致する", () => {
    const samples = ["2026-11-21T14:59:00Z", "2026-11-21T15:00:00Z", "2026-11-22T14:59:00Z", "2026-11-22T15:00:00Z"];
    for (const s of samples) {
      expect(getUpcomingMarketDateIso(0, jst(s))).toBe(getUpcomingSundayIso(jst(s)));
    }
  });

  it("範囲外の曜日は例外", () => {
    expect(() => getUpcomingMarketDateIso(9)).toThrow();
  });
});
