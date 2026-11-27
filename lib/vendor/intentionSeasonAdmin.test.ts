import { describe, expect, it } from "vitest";
import type { IntentionSeason } from "./intention";
import {
  SeasonCreateSchema,
  findOverlappingSeason,
  isCalendarDate,
  seasonStatus,
  validateSeasonWindow,
  windowForCloseNow,
  windowForOpenNow,
} from "./intentionSeasonAdmin";

const season = (seasonYear: number, opensOn: string, closesOn: string): IntentionSeason => ({
  seasonYear,
  title: `${seasonYear}年`,
  opensOn,
  closesOn,
});

describe("受付期間の日付と検証", () => {
  it("実在しない日付を弾く", () => {
    expect(isCalendarDate("2027-02-28")).toBe(true);
    expect(isCalendarDate("2026-02-30")).toBe(false);
    expect(isCalendarDate("2027-2-1")).toBe(false);
  });

  it("締切日は開始日と同じか後だけ許す", () => {
    expect(validateSeasonWindow("2027-01-10", "2027-01-10")).toBeNull();
    expect(validateSeasonWindow("2027-01-10", "2027-01-09")).toContain("締切日は開始日");
    expect(validateSeasonWindow("2027-13-01", "2027-12-01")).toContain("開始日");
  });

  it("作成の入力を検証する（年・名前・日付）", () => {
    const valid = { title: " 2027年 ", opensOn: "2027-01-01", closesOn: "2027-02-01" };
    const parsed = SeasonCreateSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.title).toBe("2027年");
    // 季節の年は開始日の年から決まる（運営は年を入力しない）
    expect(parsed.success && parsed.data.seasonYear).toBe(2027);
    expect(SeasonCreateSchema.safeParse({ ...valid, opensOn: "1999-12-31", closesOn: "2000-01-05" }).success).toBe(false);
    expect(SeasonCreateSchema.safeParse({ ...valid, title: "  " }).success).toBe(false);
    expect(SeasonCreateSchema.safeParse({ ...valid, closesOn: "2026-12-31" }).success).toBe(false);
  });
});

describe("受付期間の重なり", () => {
  const existing = [season(2026, "2026-01-01", "2026-03-31"), season(2028, "2028-01-01", "2028-03-31")];

  it("端が接していても重なりとみなす（両端を含む）", () => {
    const hit = findOverlappingSeason({ opensOn: "2026-03-31", closesOn: "2026-05-01" }, existing);
    expect(hit?.seasonYear).toBe(2026);
  });

  it("離れた期間は重ならない", () => {
    expect(findOverlappingSeason({ opensOn: "2027-01-01", closesOn: "2027-02-01" }, existing)).toBeNull();
  });

  it("変えようとしている季節自身は除いて判定する", () => {
    expect(findOverlappingSeason({ opensOn: "2026-01-05", closesOn: "2026-03-01" }, existing, 2026)).toBeNull();
  });
});

describe("受付の状態と今すぐ開く・閉じる", () => {
  const current = season(2027, "2027-01-01", "2027-02-28");

  it("今日を基準に受付前・受付中・終了を判定する", () => {
    expect(seasonStatus(current, "2026-12-31")).toBe("upcoming");
    expect(seasonStatus(current, "2027-01-01")).toBe("open");
    expect(seasonStatus(current, "2027-02-28")).toBe("open");
    expect(seasonStatus(current, "2027-03-01")).toBe("closed");
  });

  it("今すぐ開くと開始日は今日になり、締切は今日より前なら今日まで延びる", () => {
    expect(windowForOpenNow(current, "2026-12-20")).toEqual({ opensOn: "2026-12-20", closesOn: "2027-02-28" });
    expect(windowForOpenNow(season(2026, "2026-01-01", "2026-02-01"), "2026-06-01")).toEqual({
      opensOn: "2026-06-01",
      closesOn: "2026-06-01",
    });
  });

  it("今すぐ閉じると締切は昨日になり、期間の形（開始≦締切）を保つ", () => {
    expect(windowForCloseNow(current, "2027-01-10")).toEqual({ opensOn: "2027-01-01", closesOn: "2027-01-09" });
    // 開始日が今日の期間を閉じると、開始日も締切（昨日）に合わせる
    expect(windowForCloseNow(season(2027, "2027-01-10", "2027-02-28"), "2027-01-10")).toEqual({
      opensOn: "2027-01-09",
      closesOn: "2027-01-09",
    });
    // すでに締切が過ぎている期間は、締切を延ばさない
    expect(windowForCloseNow(season(2026, "2026-01-01", "2026-02-01"), "2027-01-10")).toEqual({
      opensOn: "2026-01-01",
      closesOn: "2026-02-01",
    });
  });
});
