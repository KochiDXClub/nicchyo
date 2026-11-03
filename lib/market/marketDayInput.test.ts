import { describe, expect, it } from "vitest";
import { validateMarketDayInput } from "./marketDayInput";

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
