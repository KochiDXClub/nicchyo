import { describe, expect, it } from "vitest";
import { MAX_SHOP_ID } from "@/lib/shops/route";
import { parseShopLocation } from "./shopLocation";

describe("parseShopLocation", () => {
  it("店番と座標を受け取る", () => {
    expect(parseShopLocation({ storeNumber: 12, lat: 33.5614, lng: 133.538 })).toEqual({
      ok: true,
      value: { storeNumber: 12, lat: 33.5614, lng: 133.538, source: "pin", accuracyM: null },
    });
  });

  it("店番は空でもよい（住所録に無い新しい店舗）。入れるなら範囲内の整数", () => {
    for (const storeNumber of [undefined, null]) {
      expect(parseShopLocation({ storeNumber, lat: 33.5614, lng: 133.538 })).toEqual({
        ok: true,
        value: { storeNumber: null, lat: 33.5614, lng: 133.538, source: "pin", accuracyM: null },
      });
    }
  });

  it("現在地（GPS）なら誤差を残す。ピンのときは誤差を持たない", () => {
    const gps = parseShopLocation({ storeNumber: null, lat: 33.5614, lng: 133.538, source: "gps", accuracyM: 8.26 });
    expect(gps).toMatchObject({ ok: true, value: { source: "gps", accuracyM: 8.3 } });
    const pin = parseShopLocation({ lat: 33.5614, lng: 133.538, source: "pin", accuracyM: 8 });
    expect(pin).toMatchObject({ ok: true, value: { source: "pin", accuracyM: null } });
    for (const bad of [{ source: "wifi" }, { source: "gps", accuracyM: -1 }, { source: "gps", accuracyM: "5" }]) {
      expect(parseShopLocation({ lat: 33.5614, lng: 133.538, ...bad }).ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it("店番は 1〜MAX_SHOP_ID の整数", () => {
    for (const storeNumber of [0, MAX_SHOP_ID + 1, 1.5, "12"]) {
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
