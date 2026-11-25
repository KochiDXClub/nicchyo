import { describe, expect, it } from "vitest";

import { formatShopCodeForPage, formatShopIdToCode, normalizeShopCodeToId } from "./route";

describe("normalizeShopCodeToId", () => {
  it("3桁コードを数値IDに変換する", () => {
    expect(normalizeShopCodeToId("1000")).toBe(1000);
    expect(normalizeShopCodeToId("1001")).toBe(1001);
  });

  it("範囲外や不正形式は null を返す", () => {
    // 001 形式の旧番号は URL として受け付けない（404）
    expect(normalizeShopCodeToId("001")).toBeNull();
    expect(normalizeShopCodeToId("999")).toBeNull();
    expect(normalizeShopCodeToId("000")).toBeNull();
    expect(normalizeShopCodeToId("abc")).toBeNull();
    expect(normalizeShopCodeToId("1")).toBeNull();
    expect(normalizeShopCodeToId("shops001")).toBeNull();
  });
});

describe("formatShopIdToCode", () => {
  it("店舗 ID（1000以上）だけを文字列にする", () => {
    expect(formatShopIdToCode(1000)).toBe("1000");
    expect(formatShopIdToCode(1001)).toBe("1001");
  });

  it("旧番号（場所の番号）や範囲外、整数以外は null を返す", () => {
    expect(formatShopIdToCode(1)).toBeNull();
    expect(formatShopIdToCode(300)).toBeNull();
    expect(formatShopIdToCode(999)).toBeNull();
    expect(formatShopIdToCode(0)).toBeNull();
    expect(formatShopIdToCode(1.2)).toBeNull();
  });
});

describe("formatShopCodeForPage", () => {
  it("旧番号は3桁、店舗 ID はそのまま文字列にする（店舗ページの URL 解決用）", () => {
    expect(formatShopCodeForPage(1)).toBe("001");
    expect(formatShopCodeForPage(999)).toBe("999");
    expect(formatShopCodeForPage(1000)).toBe("1000");
  });

  it("範囲外や整数以外は null を返す", () => {
    expect(formatShopCodeForPage(0)).toBeNull();
    expect(formatShopCodeForPage(1.5)).toBeNull();
  });
});
