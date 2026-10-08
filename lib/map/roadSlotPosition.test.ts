import { describe, expect, it } from "vitest";
import { latToMeters, lngToMeters } from "@/app/(public)/map/utils/mapRouteGeometry";
import { pointAlongRoad, projectOntoRoad, resolveSlotLatLng, roadLengthMeters, roadSlotLatLng } from "./roadSlotPosition";

// 西 → 東へ約 277m 伸びる道と、途中で北へ折れる道
const LAT = 33.56141;
const eastRoad = [
  { lat: LAT, lng: 133.53 },
  { lat: LAT, lng: 133.533 },
];
const bentRoad = [
  { lat: LAT, lng: 133.53 },
  { lat: LAT, lng: 133.531 },
  { lat: LAT + 0.001, lng: 133.531 },
];

const metersBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
  Math.hypot(lngToMeters(b.lng - a.lng, a.lat), latToMeters(b.lat - a.lat));

describe("roadSlotPosition", () => {
  it("道の長さは折れ線の長さの合計", () => {
    expect(roadLengthMeters(eastRoad)).toBeCloseTo(lngToMeters(0.003, LAT), 3);
    expect(roadLengthMeters(bentRoad)).toBeCloseTo(lngToMeters(0.001, LAT) + latToMeters(0.001), 3);
  });

  it("東向きの道では左が北、右が南になる", () => {
    const left = roadSlotLatLng(eastRoad, { distanceM: 100, side: "left", offsetM: 7.5 });
    const right = roadSlotLatLng(eastRoad, { distanceM: 100, side: "right", offsetM: 7.5 });
    expect(left.lat).toBeGreaterThan(LAT);
    expect(right.lat).toBeLessThan(LAT);
    expect(metersBetween(left, right)).toBeCloseTo(15, 3);
  });

  it("道の長さを超える距離は終点に丸める", () => {
    const end = pointAlongRoad(eastRoad, 10_000);
    expect(end.lng).toBeCloseTo(133.533, 9);
  });

  it("緯度経度 → 道基準の位置 → 緯度経度で元に戻る（折れた道でも）", () => {
    for (const road of [eastRoad, bentRoad]) {
      for (const point of [
        { lat: LAT + 0.00007, lng: 133.5305 },
        { lat: LAT - 0.00005, lng: 133.5302 },
        { lat: LAT + 0.0006, lng: 133.53095 },
      ]) {
        const position = projectOntoRoad(road, point);
        expect(position).not.toBeNull();
        const restored = roadSlotLatLng(road, position!);
        expect(metersBetween(point, restored)).toBeLessThan(0.01);
        expect(position!.driftM).toBeLessThan(0.01);
      }
    }
  });

  it("道の端より外の点は、戻したときのずれを driftM で知らせる", () => {
    const beyondStart = { lat: LAT + 0.00007, lng: 133.5295 };
    const position = projectOntoRoad(eastRoad, beyondStart)!;
    expect(position.distanceM).toBe(0);
    expect(position.driftM).toBeGreaterThan(1);
  });

  it("道の形を変えると、区画は道についていく", () => {
    const slot = { roadId: "r1", roadDistanceM: 50, roadSide: "left" as const, roadOffsetM: 7.5 };
    const before = resolveSlotLatLng(slot, new Map([["r1", eastRoad]]))!;
    const shifted = eastRoad.map((p) => ({ lat: p.lat + 0.0001, lng: p.lng }));
    const after = resolveSlotLatLng(slot, new Map([["r1", shifted]]))!;
    expect(after.lat - before.lat).toBeCloseTo(0.0001, 9);
  });

  it("道基準の位置を持たない区画や、道が見つからない区画は null", () => {
    expect(resolveSlotLatLng({}, new Map())).toBeNull();
    expect(resolveSlotLatLng({ roadId: "x", roadDistanceM: 1, roadSide: "left", roadOffsetM: 1 }, new Map())).toBeNull();
  });
});
