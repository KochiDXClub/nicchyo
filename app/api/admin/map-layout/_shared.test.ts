import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_ROUTE_CONFIG } from "@/app/(public)/map/types/mapRoute";
import { isRouteConfigChanged, planSlotRoadPositions, selectRepositionedShops, type EditableShop } from "./_shared";

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

describe("selectRepositionedShops", () => {
  const point = (id: string, lat: number, lng: number, order: number) => ({ id, lat, lng, order, roadId: "r1" });
  const road = (lat: number) => ({
    id: "r1",
    name: "テスト通り",
    kind: "market" as const,
    widthMeters: 20,
    points: [point("p0", lat, 133.53, 0), point("p1", lat, 133.533, 1)],
  });
  // 移行は緯度経度を変えずに道基準の位置だけを入れるので、道から計算した位置は元と少しずれる
  const shop = (id: string, lat: number): EditableShop => ({
    locationId: id,
    id: 1,
    position: 1,
    name: "空き",
    lat,
    lng: 133.531,
    roadId: "r1",
    roadDistanceM: 50,
    roadSide: "left",
    roadOffsetM: 8,
  });
  const current = shop("loc-1", 33.56141);
  const moved = { ...current, lat: 33.561412 };

  it("道の点が変わっていなければ、位置が少しずれていても計算し直さない", () => {
    expect(
      selectRepositionedShops({
        shopsAfterSave: [moved],
        currentShops: [current],
        currentRoads: [road(33.5614)],
        roadsAfterSave: [road(33.5614)],
        writtenLocationIds: new Set(),
      })
    ).toEqual([]);
  });

  it("道の点が変わったときは、その道の区画を計算し直す", () => {
    expect(
      selectRepositionedShops({
        shopsAfterSave: [moved],
        currentShops: [current],
        currentRoads: [road(33.5614)],
        roadsAfterSave: [road(33.5615)],
        writtenLocationIds: new Set(),
      }).map((s) => s.locationId)
    ).toEqual(["loc-1"]);
  });

  it("送られてきた区画は含めない", () => {
    expect(
      selectRepositionedShops({
        shopsAfterSave: [moved],
        currentShops: [current],
        currentRoads: [road(33.5614)],
        roadsAfterSave: [road(33.5615)],
        writtenLocationIds: new Set(["loc-1"]),
      })
    ).toEqual([]);
  });

  it("新しくできた道に乗る区画は計算し直す", () => {
    expect(
      selectRepositionedShops({
        shopsAfterSave: [moved],
        currentShops: [current],
        currentRoads: [],
        roadsAfterSave: [road(33.5614)],
        writtenLocationIds: new Set(),
      }).length
    ).toBe(1);
  });
});
