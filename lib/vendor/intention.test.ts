import { describe, expect, it } from "vitest";
import {
  IntentionChomeInputSchema,
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

describe("IntentionChomeInputSchema（丁目が必須、場所は任意）", () => {
  it("丁目だけを受け付ける（場所は null 扱い）", () => {
    const parsed = IntentionChomeInputSchema.parse({ chome: 3 });
    expect(parsed.chome).toBe(3);
    expect(parsed.placeId).toBeUndefined();
  });

  it("丁目と場所（UUID）を受け付ける", () => {
    expect(IntentionChomeInputSchema.safeParse({ chome: 3, placeId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
  });

  it("丁目が無い・1〜7の外・整数でないものは受け付けない", () => {
    expect(IntentionChomeInputSchema.safeParse({}).success).toBe(false);
    expect(IntentionChomeInputSchema.safeParse({ chome: 0 }).success).toBe(false);
    expect(IntentionChomeInputSchema.safeParse({ chome: 8 }).success).toBe(false);
    expect(IntentionChomeInputSchema.safeParse({ chome: 2.5 }).success).toBe(false);
  });

  it("場所の ID が UUID でなければ受け付けない", () => {
    expect(IntentionChomeInputSchema.safeParse({ chome: 3, placeId: "12" }).success).toBe(false);
  });

  it("区画数・頻度など、ほかの項目は無視する（丁目と場所だけを保存する）", () => {
    const parsed = IntentionChomeInputSchema.parse({ chome: 3, boothCount: 3, frequency: "weekly" });
    expect(parsed).toEqual({ chome: 3 });
  });
});

describe("intentionPlaceLabel", () => {
  it("区画番号を表示し、名前があれば添える", () => {
    expect(intentionPlaceLabel({ id: "a", storeNumber: 12, name: null, chome: 1, lat: null, lng: null })).toBe("12番");
    expect(intentionPlaceLabel({ id: "b", storeNumber: 3, name: "追手筋側", chome: 1, lat: null, lng: null })).toBe("3番（追手筋側）");
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
  it("回答の行を、丁目と（任意の）場所の形に変換する", () => {
    expect(
      rowToIntentionResponse({ season_year: 2027, chome: 3, place_id: null, updated_at: "2026-12-02T00:00:00Z" }),
    ).toEqual({ seasonYear: 2027, chome: 3, placeId: null, updatedAt: "2026-12-02T00:00:00Z" });
  });

  it("場所の行を、区画番号・丁目・地図の点の位置の形に変換する", () => {
    expect(
      rowToIntentionPlace({ id: "p1", store_number: 7, place_name: null, district: "3", latitude: 33.56, longitude: 133.53 }),
    ).toEqual({ id: "p1", storeNumber: 7, name: null, chome: 3, lat: 33.56, lng: 133.53 });
  });

  it("丁目が引けない場所は chome を null にする", () => {
    expect(rowToIntentionPlace({ id: "p2", store_number: 8, place_name: null, district: null, latitude: null, longitude: null }).chome).toBeNull();
  });
});
