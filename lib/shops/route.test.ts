import { describe, expect, it } from "vitest";

import { formatShopIdToCode, normalizeShopCodeToId } from "./route";

describe("normalizeShopCodeToId", () => {
  it("3桁コードを数値IDに変換する", () => {
    expect(normalizeShopCodeToId("001")).toBe(1);
    expect(normalizeShopCodeToId("010")).toBe(10);
    expect(normalizeShopCodeToId("300")).toBe(300);
    // マップ編集の区画分けで区画を増やせるよう、上限は 999（3桁で表せる最大）
    expect(normalizeShopCodeToId("301")).toBe(301);
    expect(normalizeShopCodeToId("999")).toBe(999);
  });

  it("範囲外や不正形式は null を返す", () => {
    expect(normalizeShopCodeToId("000")).toBeNull();
    expect(normalizeShopCodeToId("1000")).toBeNull();
    expect(normalizeShopCodeToId("abc")).toBeNull();
    expect(normalizeShopCodeToId("1")).toBeNull();
    expect(normalizeShopCodeToId("shops001")).toBeNull();
  });
});

describe("formatShopIdToCode", () => {
  it("数値IDを3桁コードへ変換する", () => {
    expect(formatShopIdToCode(1)).toBe("001");
    expect(formatShopIdToCode(300)).toBe("300");
    expect(formatShopIdToCode(999)).toBe("999");
  });

  it("範囲外や整数以外は null を返す", () => {
    expect(formatShopIdToCode(0)).toBeNull();
    expect(formatShopIdToCode(1000)).toBeNull();
    expect(formatShopIdToCode(1.2)).toBeNull();
  });
});
