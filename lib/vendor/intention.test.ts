import { describe, expect, it } from "vitest";
import {
  IntentionPlaceInputSchema,
  intentionPlaceLabel,
  isIntentionSeasonOpen,
  rowToIntentionPlace,
  rowToIntentionResponse,
  type IntentionSeason,
} from "./intention";

const season: IntentionSeason = {
  seasonYear: 2027,
  title: "2027年の出店意向",
  opensOn: "2026-12-01",
  closesOn: "2027-01-31",
};

describe("IntentionPlaceInputSchema", () => {
  it("場所の ID（UUID）を1つ受け付ける", () => {
    expect(IntentionPlaceInputSchema.safeParse({ placeId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
  });

  it("ID が無い・UUID でないものは受け付けない", () => {
    expect(IntentionPlaceInputSchema.safeParse({}).success).toBe(false);
    expect(IntentionPlaceInputSchema.safeParse({ placeId: "12" }).success).toBe(false);
  });

  it("区画数・頻度など、ほかの項目は無視する（場所だけを保存する）", () => {
    const parsed = IntentionPlaceInputSchema.parse({
      placeId: "11111111-1111-4111-8111-111111111111",
      boothCount: 3,
      frequency: "weekly",
    });
    expect(parsed).toEqual({ placeId: "11111111-1111-4111-8111-111111111111" });
  });
});

describe("intentionPlaceLabel", () => {
  it("区画番号を表示し、名前があれば添える", () => {
    expect(intentionPlaceLabel({ id: "a", storeNumber: 12, name: null })).toBe("12番");
    expect(intentionPlaceLabel({ id: "b", storeNumber: 3, name: "追手筋側" })).toBe("3番（追手筋側）");
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

describe("row mapping", () => {
  it("回答の行を、場所の ID つきの形に変換する", () => {
    expect(
      rowToIntentionResponse({ season_year: 2027, place_id: "p1", updated_at: "2026-12-02T00:00:00Z" }),
    ).toEqual({ seasonYear: 2027, placeId: "p1", updatedAt: "2026-12-02T00:00:00Z" });
  });

  it("場所の行を、区画番号と名前の形に変換する", () => {
    expect(rowToIntentionPlace({ id: "p1", store_number: 7, place_name: null })).toEqual({ id: "p1", storeNumber: 7, name: null });
  });
});
