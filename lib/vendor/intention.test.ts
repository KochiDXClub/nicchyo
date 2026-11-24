import { describe, expect, it } from "vitest";
import {
  IntentionInputSchema,
  isIntentionSeasonOpen,
  normalizeIntentionInput,
  rowToIntentionResponse,
  type IntentionSeason,
} from "./intention";

const season: IntentionSeason = {
  seasonYear: 2027,
  title: "2027年の出店意向",
  opensOn: "2026-12-01",
  closesOn: "2027-01-31",
};

describe("IntentionInputSchema", () => {
  it("区画数は 1〜3、頻度は決められた値だけ受け付ける", () => {
    const ok = IntentionInputSchema.safeParse({ boothCount: 2, frequency: "monthly", preferredMonths: [] });
    expect(ok.success).toBe(true);
    expect(IntentionInputSchema.safeParse({ boothCount: 4, frequency: "monthly", preferredMonths: [] }).success).toBe(false);
    expect(IntentionInputSchema.safeParse({ boothCount: 1, frequency: "daily", preferredMonths: [] }).success).toBe(false);
  });

  it("月は 1〜12、ひとことは 200 字まで", () => {
    expect(IntentionInputSchema.safeParse({ boothCount: 1, frequency: "weekly", preferredMonths: [13] }).success).toBe(false);
    expect(
      IntentionInputSchema.safeParse({ boothCount: 1, frequency: "weekly", preferredMonths: [], note: "あ".repeat(201) }).success,
    ).toBe(false);
  });
});

describe("normalizeIntentionInput", () => {
  it("月は重複を除いて昇順に、空のひとことは null にする", () => {
    const parsed = IntentionInputSchema.parse({
      boothCount: 1,
      frequency: "weekly",
      preferredMonths: [5, 3, 5, 12],
      note: "  ",
    });
    const input = normalizeIntentionInput(parsed);
    expect(input.preferredMonths).toEqual([3, 5, 12]);
    expect(input.note).toBeNull();
  });
});

describe("isIntentionSeasonOpen", () => {
  it("受付開始日と最終日の当日は受付中、その外は受付外", () => {
    expect(isIntentionSeasonOpen(season, "2026-11-30")).toBe(false);
    expect(isIntentionSeasonOpen(season, "2026-12-01")).toBe(true);
    expect(isIntentionSeasonOpen(season, "2027-01-31")).toBe(true);
    expect(isIntentionSeasonOpen(season, "2027-02-01")).toBe(false);
  });
});

describe("rowToIntentionResponse", () => {
  it("月を昇順に並べ、欠けた月の配列は空にする", () => {
    const response = rowToIntentionResponse({
      season_year: 2027,
      booth_count: 2,
      frequency: "seasonal",
      preferred_months: [4, 3],
      note: null,
      updated_at: "2026-12-02T00:00:00Z",
    });
    expect(response.preferredMonths).toEqual([3, 4]);
    const empty = rowToIntentionResponse({
      season_year: 2027,
      booth_count: 1,
      frequency: "weekly",
      preferred_months: null,
      note: null,
      updated_at: "2026-12-02T00:00:00Z",
    });
    expect(empty.preferredMonths).toEqual([]);
  });
});
