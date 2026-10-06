import { describe, expect, it } from "vitest";
import { parseShopLocation } from "./shopLocation";

describe("parseShopLocation", () => {
  it("店番と座標を受け取る。force は true のときだけ有効", () => {
    expect(parseShopLocation({ storeNumber: 12, lat: 33.5614, lng: 133.538 })).toEqual({
      ok: true,
      value: { storeNumber: 12, lat: 33.5614, lng: 133.538, force: false },
    });
    const forced = parseShopLocation({ storeNumber: 12, lat: 33.5614, lng: 133.538, force: true });
    expect(forced.ok && forced.value.force).toBe(true);
    const notBool = parseShopLocation({ storeNumber: 12, lat: 33.5614, lng: 133.538, force: "true" });
    expect(notBool.ok && notBool.value.force).toBe(false);
  });

  it("店番は1〜300の整数", () => {
    for (const storeNumber of [0, 301, 1.5, "12", null]) {
      expect(parseShopLocation({ storeNumber, lat: 33.5614, lng: 133.538 }).ok, String(storeNumber)).toBe(false);
    }
    expect(parseShopLocation({ storeNumber: 300, lat: 33.5614, lng: 133.538 }).ok).toBe(true);
  });

  it("日曜市の範囲の外の座標や数値でない座標は断る", () => {
    expect(parseShopLocation({ storeNumber: 1, lat: 35.68, lng: 139.76 }).ok).toBe(false);
    expect(parseShopLocation({ storeNumber: 1, lat: "33.56", lng: 133.538 }).ok).toBe(false);
    expect(parseShopLocation({ storeNumber: 1, lat: NaN, lng: 133.538 }).ok).toBe(false);
    expect(parseShopLocation(null).ok).toBe(false);
  });
});
