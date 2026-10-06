import { describe, expect, it } from "vitest";
import {
  buildChomeRanges,
  CHOME_PROJECTION_WARN_M,
  judgeChome,
  type ChomeBoundary,
  type ChomeSection,
} from "./chomeBoundaries";

// 20261005110000_create_chome_boundaries.sql の初期値と同じ
const boundaries: ChomeBoundary[] = [
  { id: "E", name: "駅前電車通り", lat: 33.562196, lng: 133.543152, confidence: "confirmed" },
  { id: "B1", name: "廿代通り", lat: 33.562119, lng: 133.541219, confidence: "needs_review" },
  { id: "B2", name: "グリーンロード", lat: 33.561962, lng: 133.540289, confidence: "confirmed" },
  { id: "B3", name: "堀詰通り", lat: 33.56172, lng: 133.539025, confidence: "confirmed" },
  { id: "B4", name: "中の橋通り", lat: 33.561444, lng: 133.537658, confidence: "confirmed" },
  { id: "B5", name: "大橋通り", lat: 33.560988, lng: 133.535868, confidence: "confirmed" },
  { id: "W", name: "追手門前", lat: 33.560444, lng: 133.533713, confidence: "confirmed" },
];
const sections: ChomeSection[] = [
  { chomeId: 1, roadId: "main", fromBoundaryId: "E", toBoundaryId: "B1" },
  { chomeId: 2, roadId: "main", fromBoundaryId: "B1", toBoundaryId: "B2" },
  { chomeId: 3, roadId: "main", fromBoundaryId: "B2", toBoundaryId: "B3" },
  { chomeId: 4, roadId: "main", fromBoundaryId: "B3", toBoundaryId: "B4" },
  { chomeId: 5, roadId: "main", fromBoundaryId: "B4", toBoundaryId: "B5" },
  { chomeId: 6, roadId: "main", fromBoundaryId: "B5", toBoundaryId: "W" },
  { chomeId: 7, roadId: "ohashi-dori", fromBoundaryId: "B5", toBoundaryId: null },
];

// 追手筋は東（E）→ 西（W）。境目の点を結んだ折れ線で代用する
const eastToWest = boundaries.map(({ lat, lng }) => ({ lat, lng }));
const westToEast = [...eastToWest].reverse();
// 大橋通り: 南端 → 北（20261001120000 の点）
const ohashi = [
  { lat: 33.56005, lng: 133.53612 },
  { lat: 33.56008, lng: 133.53611 },
  { lat: 33.56012, lng: 133.5361 },
  { lat: 33.56089, lng: 133.53589 },
  { lat: 33.56099, lng: 133.53587 },
  { lat: 33.56111, lng: 133.53584 },
];

function setup(main: typeof eastToWest) {
  const roads = new Map([
    ["main", main],
    ["ohashi-dori", ohashi],
  ]);
  const built = buildChomeRanges(roads, boundaries, sections);
  const distanceOf = (roadId: string, boundaryId: string) =>
    built.projections.find((p) => p.roadId === roadId && p.boundaryId === boundaryId)!.distanceM;
  return { ...built, distanceOf };
}

describe("buildChomeRanges", () => {
  it("追手筋の6区間が隙間なく並び、境目は道の上にある", () => {
    const { ranges, projections, problems } = setup(eastToWest);
    expect(problems).toEqual([]);
    const main = ranges.filter((r) => r.roadId === "main").sort((a, b) => a.startM - b.startM);
    expect(main.map((r) => r.chomeId)).toEqual([1, 2, 3, 4, 5, 6]);
    for (let i = 1; i < main.length; i += 1) expect(main[i].startM).toBeCloseTo(main[i - 1].endM, 6);
    expect(main[0].startM).toBe(0);
    for (const p of projections.filter((p) => p.roadId === "main")) {
      expect(p.offsetM).toBeLessThan(CHOME_PROJECTION_WARN_M);
    }
  });

  it("7丁目は B5 から遠いほうの道の端（南端）まで", () => {
    const { ranges, distanceOf } = setup(eastToWest);
    const seven = ranges.find((r) => r.chomeId === 7)!;
    expect(seven.startM).toBe(0);
    expect(seven.endM).toBeCloseTo(distanceOf("ohashi-dori", "B5"), 6);
  });

  it("道や境目が無いときは problems に出す", () => {
    const { problems } = buildChomeRanges(new Map(), boundaries, sections);
    expect(problems.length).toBe(sections.length);
  });
});

describe.each([
  ["始点が東の道", eastToWest],
  ["始点が西の道（向きが逆）", westToEast],
])("judgeChome: %s", (_name, main) => {
  const { ranges, projections, distanceOf } = setup(main);
  const judge = (roadId: string, distanceM: number) => judgeChome(ranges, projections, { roadId, distanceM });

  // 東側・西側の丁目（道の向きに関わらず、東から西への並びで決まる）
  const pairs: Array<[string, number | null, number | null]> = [
    ["E", null, 1],
    ["B1", 1, 2],
    ["B2", 2, 3],
    ["B3", 3, 4],
    ["B4", 4, 5],
    ["B5", 5, 6],
    ["W", 6, null],
  ];

  it.each(pairs)("境目 %s の両側 3m は東西それぞれの丁目", (id, east, west) => {
    const d = distanceOf("main", id);
    // 道の向きによって、距離が増える側が東か西かが変わる。経度で東西を決める
    const eastIsLower = main[0].lng > main[main.length - 1].lng;
    const eastD = eastIsLower ? d - 3 : d + 3;
    const westD = eastIsLower ? d + 3 : d - 3;
    if (east !== null) expect(judge("main", eastD)).toMatchObject({ status: "ok", chomeId: east });
    if (west !== null) expect(judge("main", westD)).toMatchObject({ status: "ok", chomeId: west });
  });

  it.each(pairs)("境目 %s の上（両側 1m・ちょうど）は要確認で、自動では決めない", (id) => {
    const d = distanceOf("main", id);
    for (const offset of [-1, 0, 1]) {
      expect(judge("main", d + offset)).toMatchObject({ status: "near_boundary", chomeId: null });
    }
  });

  it("要確認の候補は境目の両側の丁目", () => {
    const j = judge("main", distanceOf("main", "B3"));
    expect(j.status).toBe("near_boundary");
    if (j.status === "near_boundary") expect([...j.candidates].sort()).toEqual([3, 4]);
  });

  it("許容（2m）のぎりぎり内側は要確認、外側は確定", () => {
    const d = distanceOf("main", "B2");
    expect(judge("main", d + 2).status).toBe("near_boundary");
    expect(judge("main", d + 2.5).status).toBe("ok");
  });

  it("7丁目: 大橋通りの上は7丁目、B5 の上は要確認、北側の余りは対象外", () => {
    const b5 = distanceOf("ohashi-dori", "B5");
    expect(judge("ohashi-dori", 30)).toMatchObject({ status: "ok", chomeId: 7 });
    expect(judge("ohashi-dori", b5 - 1).status).toBe("near_boundary");
    expect(judge("ohashi-dori", b5 + 10)).toMatchObject({ status: "outside", chomeId: null });
  });

  it("区間のない道は対象外", () => {
    expect(judge("unknown", 10)).toMatchObject({ status: "outside" });
  });
});
