import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateCityMarketDate, validateMarketDayInput } from "./marketDayInput";

describe("validateMarketDayInput の画像", () => {
  const PROJECT = "https://ourproject.supabase.co";
  const original = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const own = `${PROJECT}/storage/v1/object/public/vendor-images/market-events/1-a.webp`;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = PROJECT;
  });
  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = original;
  });

  it("image_url のキーが無ければ data に含めない（既存の画像を変えないため）", () => {
    const result = validateMarketDayInput({ market_date: "2026-11-08", status: "open" });
    expect(result.data).not.toHaveProperty("image_url");
  });

  it("null は画像を外す指定として data に残す", () => {
    const result = validateMarketDayInput({ market_date: "2026-11-08", status: "open", image_url: null });
    expect(result.data?.image_url).toBeNull();
  });

  it("自分のアップロード先のURLだけ通す", () => {
    expect(
      validateMarketDayInput({ market_date: "2026-11-08", status: "open", image_url: own }).data?.image_url
    ).toBe(own);
    const foreign = "https://evil.supabase.co/storage/v1/object/public/vendor-images/market-events/1-a.webp";
    expect(
      validateMarketDayInput({ market_date: "2026-11-08", status: "open", image_url: foreign }).error
    ).toBeTruthy();
  });
});

describe("validateMarketDayInput", () => {
  it("正しい入力を整形して返す（note は前後の空白を除き、空なら null）", () => {
    expect(
      validateMarketDayInput({ market_date: "2026-11-08", status: "cancelled", note: "  雨天中止 " })
    ).toEqual({
      data: { market_date: "2026-11-08", status: "cancelled", note: "雨天中止" },
      error: null,
    });
    expect(validateMarketDayInput({ market_date: "2026-11-08", status: "open", note: "  " }).data?.note).toBeNull();
    expect(validateMarketDayInput({ market_date: "2026-11-08", status: "open" }).data?.note).toBeNull();
  });

  it("note は200文字で切る", () => {
    const result = validateMarketDayInput({
      market_date: "2026-11-08",
      status: "open",
      note: "あ".repeat(250),
    });
    expect(result.data?.note).toHaveLength(200);
  });

  it("形式の違う・実在しない・範囲外の日付を弾く", () => {
    for (const market_date of ["2026/11/08", "2026-2-3", "2026-02-31", "2019-12-29", "2101-01-03", "", 20261108]) {
      const result = validateMarketDayInput({ market_date, status: "open" });
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    }
  });

  it("未知のステータスを弾く", () => {
    for (const status of ["", "OPEN", "rain", undefined, 1]) {
      expect(validateMarketDayInput({ market_date: "2026-11-08", status }).data).toBeNull();
    }
  });

  it("オブジェクト以外を弾く", () => {
    for (const body of [null, undefined, "x", 1]) {
      expect(validateMarketDayInput(body).data).toBeNull();
    }
  });
});

describe("validateCityMarketDate", () => {
  const today = "2026-11-03"; // 火曜日

  it("今日から8週先までの日曜は通す（今日が日曜なら今日も）", () => {
    expect(validateCityMarketDate("2026-11-08", today)).toBeNull();
    expect(validateCityMarketDate("2026-12-27", today)).toBeNull(); // 8週先
    expect(validateCityMarketDate("2026-11-08", "2026-11-08")).toBeNull();
  });

  it("日曜以外・過去・遠い先は弾く", () => {
    expect(validateCityMarketDate("2026-11-09", today)).toMatch(/日曜/);
    expect(validateCityMarketDate("2026-11-01", today)).toMatch(/過去/);
    expect(validateCityMarketDate("2020-01-05", today)).toMatch(/過去/);
    expect(validateCityMarketDate("2027-01-03", today)).toMatch(/先すぎる/);
  });
});
