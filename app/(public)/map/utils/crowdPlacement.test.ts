import { describe, expect, it } from "vitest";

import { buildCrowdPeople, crowdToGeoJSON, DEFAULT_CROWD_PER_100M } from "./crowdPlacement";
import { CROWD_KINDS } from "../config/crowdParts";
import {
  distanceMeters,
  getDefaultMapRoutePoints,
  projectPointOntoRoute,
} from "./mapRouteGeometry";

const routePoints = getDefaultMapRoutePoints();
const HALF_WIDTH = 15.6;

describe("buildCrowdPeople", () => {
  it("同じ道・同じシードなら毎回まったく同じ配置になる", () => {
    const a = buildCrowdPeople(routePoints, { halfWidthMeters: HALF_WIDTH });
    const b = buildCrowdPeople(routePoints, { halfWidthMeters: HALF_WIDTH });
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it("シードを変えると並びが変わる", () => {
    const a = buildCrowdPeople(routePoints, { halfWidthMeters: HALF_WIDTH, seed: 1 });
    const b = buildCrowdPeople(routePoints, { halfWidthMeters: HALF_WIDTH, seed: 2 });
    expect(a.length).toBe(b.length);
    expect(b).not.toEqual(a);
  });

  it("密度を上げると人数が増え、上限を超えない", () => {
    const sparse = buildCrowdPeople(routePoints, {
      halfWidthMeters: HALF_WIDTH,
      perHundredMeters: DEFAULT_CROWD_PER_100M / 2,
    });
    const dense = buildCrowdPeople(routePoints, {
      halfWidthMeters: HALF_WIDTH,
      perHundredMeters: DEFAULT_CROWD_PER_100M,
    });
    expect(dense.length).toBeGreaterThan(sparse.length);

    const capped = buildCrowdPeople(routePoints, {
      halfWidthMeters: HALF_WIDTH,
      perHundredMeters: 1000,
      maxPeople: 40,
    });
    expect(capped.length).toBe(40);
  });

  it("人影は道の内側（中央寄り）にだけ立つ", () => {
    const people = buildCrowdPeople(routePoints, { halfWidthMeters: HALF_WIDTH });
    for (const person of people) {
      const projection = projectPointOntoRoute({ lat: person.lat, lng: person.lng }, routePoints);
      expect(projection).not.toBeNull();
      const distance = distanceMeters({ lat: person.lat, lng: person.lng }, projection!.point);
      // 道の縁（＝屋台の足元）には出さない
      expect(distance).toBeLessThan(HALF_WIDTH * 0.7);
    }
  });

  it("種類・反転・コマの位相はすべて既定の値域に収まる", () => {
    const people = buildCrowdPeople(routePoints, { halfWidthMeters: HALF_WIDTH });
    for (const person of people) {
      expect(CROWD_KINDS).toContain(person.kind);
      expect([0, 1]).toContain(person.flip);
      expect([0, 1]).toContain(person.phase);
    }
    // 全員が同じ位相だと「波」になって安っぽいので、位相は割れているはず
    expect(new Set(people.map((p) => p.phase)).size).toBe(2);
    expect(new Set(people.map((p) => p.kind)).size).toBeGreaterThan(1);
  });

  it("道が無ければ 0 人", () => {
    expect(buildCrowdPeople([], { halfWidthMeters: HALF_WIDTH })).toEqual([]);
  });
});

describe("crowdToGeoJSON", () => {
  it("icon-image の式が読む属性を持った Point の FeatureCollection になる", () => {
    const people = buildCrowdPeople(routePoints, { halfWidthMeters: HALF_WIDTH });
    const geojson = crowdToGeoJSON(people);
    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features).toHaveLength(people.length);
    const first = geojson.features[0];
    expect(first.geometry.coordinates).toEqual([people[0].lng, people[0].lat]);
    expect(first.properties).toEqual({
      kind: people[0].kind,
      flip: people[0].flip,
      phase: people[0].phase,
    });
  });
});
