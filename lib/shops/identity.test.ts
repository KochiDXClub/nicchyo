import { describe, expect, it } from "vitest";

import { parseShopIdentity } from "./identity";

describe("public shop identity", () => {
  it("店舗 ID（1000以上）だけを受け付ける", () => {
    expect(parseShopIdentity("1000")).toBe(1000);
    expect(parseShopIdentity("2147483647")).toBe(2147483647);
  });

  it("001 形式の旧番号や範囲外、不正な形式は null", () => {
    for (const code of ["001", "999", "000", "1", "01000", "2147483648", "-001", "1.0"]) expect(parseShopIdentity(code)).toBeNull();
  });
});
