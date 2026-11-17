import { describe, expect, it } from "vitest";
import { formatMarketAddress, formatPlaceVendorNumber, parseMarketAddress } from "./address";
describe("住所と場所内の店舗番号", () => {
  it("枝番付き住所を別々の場所として扱い、店舗番号と混ぜない", () => {
    const first = parseMarketAddress("１８３－１")!;
    const second = parseMarketAddress("183-2")!;
    expect(formatMarketAddress(first)).toBe("183-1");
    expect(formatMarketAddress(second)).toBe("183-2");
    expect(formatPlaceVendorNumber(first, 1)).toBe("住所 183-1 ／ 店舗1");
    expect(formatPlaceVendorNumber({ main: 512, branch: null }, 2)).toBe("住所 512 ／ 店舗2");
  });
  it("曖昧な表記・ゼロは受け付けず、未設定の店舗番号を明示する", () => {
    for (const value of ["183-1-2", "0", "183-0", "", "1番地"]) expect(parseMarketAddress(value)).toBeNull();
    expect(formatPlaceVendorNumber({ main: 183, branch: 1 }, null)).toContain("店舗番号未設定");
  });
});
