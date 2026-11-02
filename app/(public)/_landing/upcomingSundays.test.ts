import { describe, expect, it } from "vitest";
import { buildLandingSundays } from "./upcomingSundays";

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

  it("想定外の状態は開催として扱う", () => {
    const [first] = buildLandingSundays([{ market_date: "2026-10-18", status: "??" as never, note: null }], NOW, 1);
    expect(first.status).toBe("open");
  });

  it("日曜の当日は、その日を先頭にする（JST）", () => {
    const sundayMorningJst = new Date("2026-10-17T22:30:00Z"); // JST 10/18 7:30
    expect(buildLandingSundays([], sundayMorningJst, 1)[0].dateIso).toBe("2026-10-18");
  });
});
