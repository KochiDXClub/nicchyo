import { describe, expect, it } from "vitest";
import { buildChomeRanges, type ChomeBoundary, type ChomeSection } from "./chomeBoundaries";
import {
  CHOME_MAX_ACCURACY_M,
  CHOME_MAX_LATERAL_M,
  judgeChomeFromLocation,
  type ChomeFromLocationContext,
} from "./chomeFromLocation";
import { projectOntoRoad, roadLengthMeters, roadSlotLatLng } from "./roadSlotPosition";

type LatLng = { lat: number; lng: number };

const ACCURACY = 5;

function contextOf(
  roads: Map<string, LatLng[]>,
  boundaries: ChomeBoundary[],
  sections: ChomeSection[]
): ChomeFromLocationContext & { distanceOf: (roadId: string, boundaryId: string) => number } {
  const { ranges, projections, problems } = buildChomeRanges(roads, boundaries, sections);
  expect(problems).toEqual([]);
  return {
    roads,
    ranges,
    projections,
    distanceOf: (roadId, boundaryId) =>
      projections.find((p) => p.roadId === roadId && p.boundaryId === boundaryId)!.distanceM,
  };
}

/** 道の始点（"start"）または終点（"end"）から、道の向きに沿って m だけ外へ出た点 */
function beyondEnd(points: LatLng[], end: "start" | "end", m: number): LatLng {
  const [from, next] = end === "start" ? [points[0], points[1]] : [points[points.length - 1], points[points.length - 2]];
  const cos = Math.cos((from.lat * Math.PI) / 180);
  const dx = (from.lng - next.lng) * 111320 * cos;
  const dy = (from.lat - next.lat) * 110540;
  const len = Math.hypot(dx, dy);
  return { lat: from.lat + ((dy / len) * m) / 110540, lng: from.lng + ((dx / len) * m) / (111320 * cos) };
}

const judge = (ctx: ChomeFromLocationContext, point: LatLng, accuracyM: number | null = ACCURACY) =>
  judgeChomeFromLocation({ ...point, accuracyM }, ctx);

describe("judgeChomeFromLocation（合成の直線の道）", () => {
  // 東（始点）→ 西（終点）の 1000m の直線。境目は 0 / 200 / 400 / 600 / 800 / 1000m（両端も境目。実データの E / W と同じ）
  const origin = { lat: 33.56, lng: 133.54 };
  const road = [origin, { lat: 33.56, lng: 133.54 - 1000 / (111320 * Math.cos((33.56 * Math.PI) / 180)) }];
  const at = (distanceM: number, side: "left" | "right" = "left", offsetM = 0) =>
    roadSlotLatLng(road, { distanceM, side, offsetM });
  const boundaries: ChomeBoundary[] = [0, 200, 400, 600, 800, 1000].map((d, i) => ({
    id: `b${i + 1}`,
    name: `境目${i + 1}`,
    ...at(d),
    confidence: "confirmed",
  }));
  const sections: ChomeSection[] = [
    { chomeId: 1, roadId: "r", fromBoundaryId: "b1", toBoundaryId: "b2" },
    { chomeId: 2, roadId: "r", fromBoundaryId: "b2", toBoundaryId: "b3" },
    { chomeId: 3, roadId: "r", fromBoundaryId: "b3", toBoundaryId: "b4" },
    { chomeId: 4, roadId: "r", fromBoundaryId: "b4", toBoundaryId: "b5" },
    { chomeId: 5, roadId: "r", fromBoundaryId: "b5", toBoundaryId: "b6" },
  ];
  const ctx = contextOf(new Map([["r", road]]), boundaries, sections);

  it("各区間の真ん中は、その丁目になる（道の左右どちら側でも）", () => {
    expect([100, 300, 500, 700, 900].map((d) => judge(ctx, at(d)))).toEqual([1, 2, 3, 4, 5]);
    expect([100, 300, 500, 700, 900].map((d) => judge(ctx, at(d, "right", 12)))).toEqual([1, 2, 3, 4, 5]);
    expect([100, 300, 500, 700, 900].map((d) => judge(ctx, at(d, "left", 12)))).toEqual([1, 2, 3, 4, 5]);
  });

  it("境目の許容（精度ぶん）に入る点は unknown、その外は丁目になる", () => {
    expect(judge(ctx, at(400))).toBe("unknown");
    expect(judge(ctx, at(400 - 4))).toBe("unknown");
    expect(judge(ctx, at(400 + 4))).toBe("unknown");
    // 精度が 5m なら、境目から 10m 離れれば決められる
    expect(judge(ctx, at(400 - 10))).toBe(2);
    expect(judge(ctx, at(400 + 10))).toBe(3);
    // 精度が悪いほど境目の近くでは決めない
    expect(judge(ctx, at(400 + 10), 20)).toBe("unknown");
    expect(judge(ctx, at(400 + 30), 20)).toBe(3);
  });

  it("どの道からも遠い点は outside", () => {
    expect(judge(ctx, at(500, "left", CHOME_MAX_LATERAL_M + 5))).toBe("outside");
    expect(judge(ctx, at(500, "right", CHOME_MAX_LATERAL_M + 5))).toBe("outside");
    expect(judge(ctx, at(500, "left", CHOME_MAX_LATERAL_M - 5))).toBe(3);
    expect(judge(ctx, { lat: 35.68, lng: 139.76 })).toBe("outside");
  });

  it("道の端より先に出た点は outside（端の丁目にしない）", () => {
    expect(judge(ctx, beyondEnd(road, "start", 40))).toBe("outside");
    expect(judge(ctx, beyondEnd(road, "end", 40))).toBe("outside");
    // 端の少し先は GPS の誤差の範囲。端は境目なので丁目は決めない
    expect(judge(ctx, beyondEnd(road, "start", 3))).toBe("unknown");
    expect(judge(ctx, beyondEnd(road, "end", 3))).toBe("unknown");
    // 端の真横（道の外にはみ出していない）は、境目から離れていれば丁目
    expect(judge(ctx, at(15, "left", 15))).toBe(1);
    expect(judge(ctx, at(985, "right", 15))).toBe(5);
  });

  it("精度が無い・悪い・おかしいときは unknown", () => {
    const p = at(300);
    expect(judge(ctx, p, null)).toBe("unknown");
    expect(judge(ctx, p, NaN)).toBe("unknown");
    expect(judge(ctx, p, -1)).toBe("unknown");
    expect(judge(ctx, p, Infinity)).toBe("unknown");
    expect(judge(ctx, p, CHOME_MAX_ACCURACY_M)).toBe(2);
    expect(judge(ctx, p, CHOME_MAX_ACCURACY_M + 1)).toBe("unknown");
    // 精度が悪ければ、道から遠い点でも outside とは言わない
    expect(judge(ctx, at(500, "left", 200), 100)).toBe("unknown");
  });

  it("座標が数でないときは unknown", () => {
    expect(judge(ctx, { lat: NaN, lng: 133.5 })).toBe("unknown");
    expect(judge(ctx, { lat: 33.5, lng: Infinity })).toBe("unknown");
  });

  it("道のデータがまだ無いときは unknown（outside とは言えない）", () => {
    expect(judge({ roads: new Map(), ranges: ctx.ranges, projections: ctx.projections }, at(300))).toBe("unknown");
    expect(judge({ roads: ctx.roads, ranges: [], projections: [] }, at(300))).toBe("unknown");
  });

  it("opts で定数を上書きできる", () => {
    const point = at(500, "left", 20);
    expect(judge(ctx, point)).toBe(3);
    expect(judgeChomeFromLocation({ ...point, accuracyM: ACCURACY }, ctx, { maxLateralM: 10 })).toBe("outside");
    expect(judgeChomeFromLocation({ ...at(300), accuracyM: 40 }, ctx, { maxAccuracyM: 50 })).toBe(2);
    expect(judgeChomeFromLocation({ ...at(400 + 10), accuracyM: 1 }, ctx, { boundaryToleranceM: 15 })).toBe("unknown");
  });

  it("入力の座標をそのまま戻さない（戻り値は丁目か文字列のみ）", () => {
    const result = judge(ctx, at(300));
    expect(["number", "string"]).toContain(typeof result);
  });
});

// 20261010110000_create_chome_boundaries.sql の初期値・20261001120000 の大橋通りの点と同じ
describe("judgeChomeFromLocation（実際の境目の座標）", () => {
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
  // 追手筋は境目の点を結んだ折れ線で代用する（東 → 西）
  const main = boundaries.map(({ lat, lng }) => ({ lat, lng }));
  // 大橋通り: 南端 → 北（B5 は北寄り）
  const ohashi = [
    { lat: 33.56005, lng: 133.53612 },
    { lat: 33.56008, lng: 133.53611 },
    { lat: 33.56012, lng: 133.5361 },
    { lat: 33.56089, lng: 133.53589 },
    { lat: 33.56099, lng: 133.53587 },
    { lat: 33.56111, lng: 133.53584 },
  ];
  const ctx = contextOf(
    new Map([
      ["main", main],
      ["ohashi-dori", ohashi],
    ]),
    boundaries,
    sections
  );

  const mainAt = (boundaryFrom: string, boundaryTo: string, side: "left" | "right" = "left", offsetM = 4) => {
    const from = ctx.distanceOf("main", boundaryFrom);
    const to = ctx.distanceOf("main", boundaryTo);
    return roadSlotLatLng(main, { distanceM: (from + to) / 2, side, offsetM });
  };

  it("追手筋の各丁目の真ん中は、その丁目になる", () => {
    expect(judge(ctx, mainAt("E", "B1"))).toBe(1);
    expect(judge(ctx, mainAt("B1", "B2"))).toBe(2);
    expect(judge(ctx, mainAt("B2", "B3"))).toBe(3);
    expect(judge(ctx, mainAt("B3", "B4"))).toBe(4);
    expect(judge(ctx, mainAt("B4", "B5"))).toBe(5);
    expect(judge(ctx, mainAt("B5", "W", "right", 15))).toBe(6);
  });

  it("実際の境目の座標そのものは unknown", () => {
    for (const b of boundaries) expect(judge(ctx, { lat: b.lat, lng: b.lng })).toBe("unknown");
  });

  it("大橋通りの南の点は、追手筋ではなく大橋通り（7丁目）になる", () => {
    const sevenSouth = roadSlotLatLng(ohashi, { distanceM: 20, side: "right", offsetM: 3 });
    // 追手筋まで 50m 以上離れているので、近い道は大橋通り
    expect(projectOntoRoad(main, sevenSouth)!.lateralM).toBeGreaterThan(50);
    expect(judge(ctx, sevenSouth)).toBe(7);
    const sevenMiddle = roadSlotLatLng(ohashi, { distanceM: roadLengthMeters(ohashi) / 3, side: "left", offsetM: 6 });
    expect(judge(ctx, sevenMiddle)).toBe(7);
  });

  it("追手筋の上の点は、近い追手筋を選ぶ（大橋通りに引っ張られない）", () => {
    const nearJunction = mainAt("B4", "B5", "left", 3);
    expect(judge(ctx, nearJunction)).toBe(5);
  });

  it("大橋通りの南端の先は outside", () => {
    expect(judge(ctx, beyondEnd(ohashi, "start", 20))).toBe("outside");
    // 南端は境目ではないので、端の少し先（GPS の誤差の範囲）は 7丁目のまま
    expect(judge(ctx, beyondEnd(ohashi, "start", 3))).toBe(7);
  });

  it("追手筋の東端・西端の先は outside", () => {
    expect(judge(ctx, beyondEnd(main, "start", 25))).toBe("outside");
    expect(judge(ctx, beyondEnd(main, "end", 25))).toBe("outside");
  });

  it("日曜市から離れた高知駅前は outside", () => {
    expect(judge(ctx, { lat: 33.5675, lng: 133.5435 })).toBe("outside");
  });
});
