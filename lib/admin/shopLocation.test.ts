import { describe, expect, it } from "vitest";
import { MAX_SHOP_ID } from "@/lib/shops/route";
import { parseShopLocation } from "./shopLocation";

describe("parseShopLocation", () => {
  it("店番と座標を受け取る", () => {
    expect(parseShopLocation({ storeNumber: 12, lat: 33.5614, lng: 133.538 })).toEqual({
      ok: true,
      value: { storeNumber: 12, lat: 33.5614, lng: 133.538 },
    });
  });

  it("店番は 1〜MAX_SHOP_ID の整数", () => {
    for (const storeNumber of [0, MAX_SHOP_ID + 1, 1.5, "12", null]) {
      expect(parseShopLocation({ storeNumber, lat: 33.5614, lng: 133.538 }).ok, String(storeNumber)).toBe(false);
    }
    expect(parseShopLocation({ storeNumber: MAX_SHOP_ID, lat: 33.5614, lng: 133.538 }).ok).toBe(true);
  });

  it("日曜市の範囲の外の座標や数値でない座標は断る", () => {
    expect(parseShopLocation({ storeNumber: 1, lat: 35.68, lng: 139.76 }).ok).toBe(false);
    expect(parseShopLocation({ storeNumber: 1, lat: "33.56", lng: 133.538 }).ok).toBe(false);
    expect(parseShopLocation({ storeNumber: 1, lat: NaN, lng: 133.538 }).ok).toBe(false);
    expect(parseShopLocation(null).ok).toBe(false);
  });
});
