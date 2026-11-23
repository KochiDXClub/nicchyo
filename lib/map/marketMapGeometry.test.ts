import { describe, expect, it } from "vitest";
import { DEFAULT_MAP_VIEW_SETTINGS } from "./mapViewSettings";
import type { MapRoad, MapRoutePoint } from "@/app/(public)/map/types/mapRoute";
import { getMarketMapGeometry, resolveMarketMapBounds, scopePublicMapRoute } from "./marketMapGeometry";

const roads: MapRoad[] = [
  { id: "otesuji", name: "追手筋", kind: "market", widthMeters: 20, marketId: "sunday" },
  { id: "kencho", name: "県庁前通り", kind: "market", widthMeters: 20, marketId: "thursday" },
];
const points: MapRoutePoint[] = [
  { id: "s1", lat: 33.562, lng: 133.532, order: 0, roadId: "otesuji" },
  { id: "s2", lat: 33.561, lng: 133.541, order: 1, roadId: "otesuji" },
  { id: "t1", lat: 33.556, lng: 133.529, order: 2, roadId: "kencho" },
  { id: "t2", lat: 33.556, lng: 133.533, order: 3, roadId: "kencho" },
];

describe("market map geometry", () => {
  it("選んだ市の道路から始まり、可動範囲は全公開市を含む", () => {
    const camera = getMarketMapGeometry(points, roads, "thursday", "sunday");
    expect(camera.initialPoints).toEqual(points.slice(2));
    expect(camera.ensureMarketBounds).toBe(true);
    const bounds = resolveMarketMapBounds(points, DEFAULT_MAP_VIEW_SETTINGS, camera.ensureMarketBounds);
    expect(bounds).toMatchObject({ north: expect.any(Number), west: expect.any(Number) });
    for (const { lat, lng } of points) {
      expect(lat).toBeGreaterThan(bounds.south);
      expect(lat).toBeLessThan(bounds.north);
      expect(lng).toBeGreaterThan(bounds.west);
      expect(lng).toBeLessThan(bounds.east);
    }
  });

  it("日曜市だけの手動設定を保ち、木曜市を含まない手動枠は自動範囲へ戻す", () => {
    const bounds = { north: 33.565, south: 33.559, east: 133.547, west: 133.527 };
    const settings = { ...DEFAULT_MAP_VIEW_SETTINGS, mode: "manual" as const, bounds };
    expect(resolveMarketMapBounds(points.slice(0, 2), settings, false)).toEqual(bounds);
    expect(resolveMarketMapBounds(points, settings, true).south).toBeLessThan(points[2].lat);
    const inclusive = { ...settings, bounds: { ...bounds, south: 33.55 } };
    expect(resolveMarketMapBounds(points, inclusive, true)).toEqual(inclusive.bounds);
  });

  it("木曜市だけ公開されているときも旧日曜市の手動枠に閉じ込めない", () => {
    const thursday = points.slice(2);
    const camera = getMarketMapGeometry(thursday, roads, "thursday");
    expect(camera.ensureMarketBounds).toBe(true);
    const bounds = { north: 33.565, south: 33.559, east: 133.547, west: 133.527 };
    const settings = { ...DEFAULT_MAP_VIEW_SETTINGS, mode: "manual" as const, bounds };
    expect(resolveMarketMapBounds(thursday, settings, camera.ensureMarketBounds).south).toBeLessThan(thursday[0].lat);
  });

  it("旧データの所属なしの道路点は日曜市の初期表示に含める", () => {
    const legacyPoints = points.map((point, index) => index < 2 ? { ...point, roadId: null } : point);
    expect(getMarketMapGeometry(legacyPoints, roads, "sunday", "sunday").initialPoints).toEqual(legacyPoints.slice(0, 2));
  });
});

it("非公開の道路を除き、公開されている別の市と枝をつながない", () => {
  const config = { key: "default", roadHalfWidthMeters: 11, snapDistanceMeters: 18, visibleDistanceMeters: 42 };
  const route = { config, roads, points: points.map((point) => point.id === "t1" ? { ...point, branchFromId: "s1" } : point) };
  const publicRoute = scopePublicMapRoute(route, new Set(["sunday", "thursday"]), "sunday");
  expect(publicRoute.points[2].branchFromId).toBeNull();
  const sundayOnly = scopePublicMapRoute(route, new Set(["sunday"]), "sunday");
  expect(sundayOnly.points).toEqual(points.slice(0, 2));
  expect(sundayOnly.roads).toEqual(roads.slice(0, 1));
});
