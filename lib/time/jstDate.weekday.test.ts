import { describe, expect, it } from "vitest";
import { nextSundayJstString, nextWeekdayJstString } from "@/lib/time/jstDate";

// JST は UTC+9。UTC の時刻で指定する。
const jst = (iso: string) => new Date(iso);

describe("nextWeekdayJstString", () => {
  it("木曜（4）: 水曜の夜は翌日の木曜、木曜の当日はその日、金曜の0時は翌週", () => {
    expect(nextWeekdayJstString(4, jst("2026-11-18T14:00:00Z"))).toBe("2026-11-19"); // 水 23:00 JST
    expect(nextWeekdayJstString(4, jst("2026-11-18T15:30:00Z"))).toBe("2026-11-19"); // 木 00:30 JST
    expect(nextWeekdayJstString(4, jst("2026-11-19T14:59:00Z"))).toBe("2026-11-19"); // 木 23:59 JST
    expect(nextWeekdayJstString(4, jst("2026-11-19T15:00:00Z"))).toBe("2026-11-26"); // 金 00:00 JST
  });

  it("日曜（0）の結果は nextSundayJstString と一致する", () => {
    const samples = ["2026-11-21T14:59:00Z", "2026-11-21T15:00:00Z", "2026-11-22T14:59:00Z", "2026-11-22T15:00:00Z"];
    for (const s of samples) {
      expect(nextWeekdayJstString(0, jst(s))).toBe(nextSundayJstString(jst(s)));
    }
  });

  it("日曜の境界: 土 23:59 JST は今度の日曜、日 0:00 JST は当日", () => {
    expect(nextSundayJstString(jst("2026-11-21T14:59:00Z"))).toBe("2026-11-22");
    expect(nextSundayJstString(jst("2026-11-21T15:00:00Z"))).toBe("2026-11-22");
    expect(nextSundayJstString(jst("2026-11-22T14:59:00Z"))).toBe("2026-11-22");
    expect(nextSundayJstString(jst("2026-11-22T15:00:00Z"))).toBe("2026-11-29");
  });

  it("範囲外の曜日は例外", () => {
    expect(() => nextWeekdayJstString(7)).toThrow();
    expect(() => nextWeekdayJstString(-1)).toThrow();
    expect(() => nextWeekdayJstString(1.5)).toThrow();
  });
});
