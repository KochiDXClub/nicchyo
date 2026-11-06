import { describe, expect, it } from "vitest";
import { parseShopIdentity, resolveLegacyShopId } from "./identity";

describe("public shop identity", () => {
  it("keeps old location codes and permanent vendor IDs in separate namespaces", () => {
    expect(parseShopIdentity("001")).toEqual({ kind: "legacy", id: 1 });
    expect(parseShopIdentity("999")).toEqual({ kind: "legacy", id: 999 });
    expect(parseShopIdentity("1000")).toEqual({ kind: "vendor", id: 1000 });
    for (const code of ["000", "1", "01000", "2147483648", "-001", "1.0"]) expect(parseShopIdentity(code)).toBeNull();
  });
  it("never resolves an unconfirmed or unavailable shop as a different shop", () => {
    const aliases = new Map([[1, 1000], [2, 1001]]);
    expect(resolveLegacyShopId(1, aliases, new Set([1000]))).toBe(1000);
    expect(resolveLegacyShopId(2, aliases, new Set([1000]))).toBeNull();
    expect(resolveLegacyShopId(3, aliases, new Set([1000]))).toBeNull();
  });
});
