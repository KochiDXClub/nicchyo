import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_ROUTE_CONFIG } from "@/app/(public)/map/types/mapRoute";
import { hasRoadPositionSchema, isRouteConfigChanged, planSlotRoadPositions, validateVendorDrafts, type EditableShop, type EditableVendor } from "./_shared";

describe("isRouteConfigChanged", () => {
  it("同じ値なら変更なし", () => {
    expect(isRouteConfigChanged(DEFAULT_MAP_ROUTE_CONFIG, { ...DEFAULT_MAP_ROUTE_CONFIG })).toBe(false);
  });

  it.each([
    ["roadHalfWidthMeters", { roadHalfWidthMeters: 20 }],
    ["snapDistanceMeters", { snapDistanceMeters: 10 }],
    ["visibleDistanceMeters", { visibleDistanceMeters: 60 }],
    ["key", { key: "other" }],
  ] as const)("%s が変わっていれば変更あり", (_label, patch) => {
    expect(isRouteConfigChanged(DEFAULT_MAP_ROUTE_CONFIG, { ...DEFAULT_MAP_ROUTE_CONFIG, ...patch })).toBe(
      true
    );
  });
});

describe("planSlotRoadPositions", () => {
  const road = {
    id: "r1",
    name: "テスト通り",
    kind: "market" as const,
    widthMeters: 36,
    points: [
      { id: "p0", lat: 33.56141, lng: 133.53, order: 0, roadId: "r1" },
      { id: "p1", lat: 33.56141, lng: 133.533, order: 1, roadId: "r1" },
    ],
  };
  const shop = (position: number, lat: number, lng: number, extra: Partial<EditableShop> = {}): EditableShop => ({
    locationId: `loc-${position}`,
    id: position,
    position,
    name: `店${position}`,
    lat,
    lng,
    ...extra,
  });

  it("道の近くの区画は道基準の位置に変換し、遠い区画は変換せずに報告する", () => {
    const plan = planSlotRoadPositions(
      [shop(1, 33.56148, 133.531), shop(2, 33.56134, 133.531), shop(3, 33.5625, 133.531)],
      [road],
      18
    );
    expect(plan.matched.map((m) => [m.position, m.roadSide])).toEqual([
      [1, "left"],
      [2, "right"],
    ]);
    expect(plan.matched[0].roadOffsetM).toBeCloseTo(7.7, 0);
    expect(plan.unmatched).toEqual([
      expect.objectContaining({ position: 3, nearestRoadName: "テスト通り" }),
    ]);
    expect(plan.unmatched[0].distanceToNearestRoadM).toBeGreaterThan(100);
  });

  it("すでに道基準の位置を持つ区画は対象にしない", () => {
    const anchored = shop(1, 33.56148, 133.531, { roadId: "r1", roadDistanceM: 90, roadSide: "left", roadOffsetM: 7 });
    const plan = planSlotRoadPositions([anchored], [road], 18);
    expect(plan.matched).toEqual([]);
    expect(plan.unmatched).toEqual([]);
  });

  it("道が1本も無ければすべて報告に回す", () => {
    const plan = planSlotRoadPositions([shop(1, 33.56148, 133.531)], [], 18);
    expect(plan.unmatched).toEqual([expect.objectContaining({ position: 1, nearestRoadName: null, distanceToNearestRoadM: null })]);
  });
});

describe("validateVendorDrafts", () => {
  const context = { existingVendorIds: new Set(["v1"]), categoryIds: new Set(["c1"]) };
  const draft = (patch: Partial<EditableVendor> = {}): EditableVendor => ({
    id: "new-vendor-1",
    name: "朝市の八百屋",
    categoryId: "c1",
    strength: "",
    mainProducts: ["柚子"],
    ...patch,
  });

  it("新しい出店者と既存の出店者の正しい入力は通す", () => {
    expect(validateVendorDrafts([draft(), draft({ id: "v1", categoryId: null })], context)).toBeNull();
  });

  it.each([
    ["存在しない既存の出店者", draft({ id: "v-unknown" }), "存在しない出店者"],
    ["店名が空", draft({ name: "  " }), "店名を入れてください"],
    ["店名が長すぎる", draft({ name: "あ".repeat(61) }), "60 文字以内"],
    ["存在しないジャンル", draft({ categoryId: "c-unknown" }), "ジャンル"],
    ["こだわりが長すぎる", draft({ strength: "あ".repeat(401) }), "こだわり"],
    ["主な商品が多すぎる", draft({ mainProducts: Array.from({ length: 11 }, (_, i) => `品${i}`) }), "主な商品"],
    ["主な商品に空の項目", draft({ mainProducts: [" "] }), "主な商品"],
  ])("%s は理由を返す", (_label, vendor, message) => {
    expect(validateVendorDrafts([vendor], context)).toContain(message);
  });

  it("同じ出店者が2回送られてきたら拒否する", () => {
    expect(validateVendorDrafts([draft(), draft()], context)).toContain("正しくありません");
  });
});

describe("hasRoadPositionSchema", () => {
  const clientReturning = (error: { code: string } | null) =>
    ({
      from: () => ({ select: () => ({ limit: async () => ({ data: [], error }) }) }),
    }) as unknown as Parameters<typeof hasRoadPositionSchema>[0];

  it("道基準の位置の列があれば true", async () => {
    await expect(hasRoadPositionSchema(clientReturning(null))).resolves.toBe(true);
  });

  it("列が無い（マイグレーション前）なら false", async () => {
    await expect(hasRoadPositionSchema(clientReturning({ code: "42703" }))).resolves.toBe(false);
  });

  it("それ以外のエラーは握りつぶさずに投げる", async () => {
    await expect(hasRoadPositionSchema(clientReturning({ code: "08006" }))).rejects.toThrow();
  });
});
