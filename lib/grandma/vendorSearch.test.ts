import { describe, it, expect } from "vitest";
import { summarizeShops, sortShopIdsByDistance } from "./vendorSearch";
import type { Shop } from "@/app/(public)/map/data/shops";

const makeShop = (overrides: Partial<Shop> & { id: number }): Shop => ({
  vendorId: `vendor-${overrides.id}`,
  name: `店舗${overrides.id}`,
  ownerName: "",
  category: "野菜",
  products: [],
  description: "",
  position: overrides.id,
  lat: 33.565,
  lng: 133.531,
  schedule: "",
  paymentMethods: [],
  ...overrides,
});

describe("summarizeShops", () => {
  it("空配列は '該当なし' を返す", () => {
    expect(summarizeShops([])).toBe("該当なし");
  });

  it("店舗情報を1行ずつ返す", () => {
    const shops = [makeShop({ id: 1, name: "山田青果", category: "野菜", products: ["トマト", "きゅうり"] })];
    const result = summarizeShops(shops);
    expect(result).toContain("id:1");
    expect(result).toContain("name:山田青果");
    expect(result).toContain("category:野菜");
    expect(result).toContain("products:トマト / きゅうり");
  });

  it("6件を超える場合は最初の6件のみ返す（デフォルト上限）", () => {
    const shops = Array.from({ length: 10 }, (_, i) => makeShop({ id: i + 1 }));
    const result = summarizeShops(shops);
    const lines = result.split("\n");
    expect(lines.length).toBe(6);
  });

  it("limit を渡すとその件数まで返す（おさんぽプランのベクトル候補10件など）", () => {
    const shops = Array.from({ length: 12 }, (_, i) => makeShop({ id: i + 1 }));
    const result = summarizeShops(shops, 10);
    const lines = result.split("\n");
    expect(lines.length).toBe(10);
    expect(lines[9]).toContain("id:10");
  });

  it("shopStrengthがあれば含む", () => {
    const shops = [makeShop({ id: 1, shopStrength: "新鮮な朝採り野菜" })];
    expect(summarizeShops(shops)).toContain("strength:新鮮な朝採り野菜");
  });

  it("scheduleがあれば含む", () => {
    const shops = [makeShop({ id: 1, schedule: "毎週日曜" })];
    expect(summarizeShops(shops)).toContain("schedule:毎週日曜");
  });
});

describe("sortShopIdsByDistance", () => {
  const shops = [
    makeShop({ id: 1, lat: 33.565, lng: 133.531 }),
    makeShop({ id: 2, lat: 33.570, lng: 133.535 }),
    makeShop({ id: 3, lat: 33.560, lng: 133.528 }),
  ];

  it("locationがnullのときは元の順序を返す", () => {
    expect(sortShopIdsByDistance([1, 2, 3], shops, null)).toEqual([1, 2, 3]);
  });

  it("近い店舗から順に並び替える", () => {
    const location = { lat: 33.565, lng: 133.531 }; // id:1 と同じ座標
    const sorted = sortShopIdsByDistance([1, 2, 3], shops, location);
    expect(sorted[0]).toBe(1);
  });

  it("shop一覧に存在しないidはInfinityとして末尾になる", () => {
    const location = { lat: 33.565, lng: 133.531 };
    const sorted = sortShopIdsByDistance([999, 1], shops, location);
    expect(sorted[sorted.length - 1]).toBe(999);
  });

  it("空配列は空配列を返す", () => {
    expect(sortShopIdsByDistance([], shops, { lat: 33.565, lng: 133.531 })).toEqual([]);
  });
});
