import { describe, expect, it } from "vitest";
import { getRouteChains, getRouteSegments, projectPointOntoRoute } from "./mapRouteGeometry";
import type { MapRoutePoint } from "../types/mapRoute";

const point = (id: string, lat: number, lng: number, order: number, roadId?: string | null): MapRoutePoint => ({
  id,
  lat,
  lng,
  order,
  roadId,
});

describe("複数の道", () => {
  // 東西の通り（r1）と、少し離れた南北の道（r2）。保存時は道ごとにまとまって並ぶ
  const points = [
    point("a0", 33.5614, 133.53, 0, "r1"),
    point("a1", 33.5614, 133.533, 1, "r1"),
    point("b0", 33.5605, 133.534, 2, "r2"),
    point("b1", 33.5595, 133.534, 3, "r2"),
  ];

  it("別々の道の終点と始点はつながない", () => {
    const segments = getRouteSegments(points);
    expect(segments.map((s) => `${s.start.id}-${s.end.id}`)).toEqual(["a0-a1", "b0-b1"]);
  });

  it("道ごとに独立した線（チェーン）になる", () => {
    const chains = getRouteChains(points).map((chain) => chain.points.map((p) => p.id).join(","));
    expect(chains.sort()).toEqual(["a0,a1", "b0,b1"]);
  });

  it("道と道の間の空き地には吸着しない", () => {
    // r1 の終点と r2 の始点の中間。つないでいた頃は、その間の線に吸着していた
    const between = { lat: 33.56095, lng: 133.5335 };
    const projection = projectPointOntoRoute(between, points)!;
    expect(projection.distanceMeters).toBeGreaterThan(40);
  });

  it("road_id を持たない点（古いデータ）は、これまでどおり1本の道としてつなぐ", () => {
    const legacy = points.map((p) => ({ ...p, roadId: null }));
    expect(getRouteSegments(legacy)).toHaveLength(3);
    expect(getRouteChains(legacy)).toHaveLength(1);
  });
});
