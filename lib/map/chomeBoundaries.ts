import type { ChomeId } from "./chomes";
import { pointAlongRoad, projectOntoRoad, roadLengthMeters } from "./roadSlotPosition";

/**
 * 日曜市の丁目の境目と、区画の丁目の自動判定。
 *
 * 境目は交差点の緯度経度（点）で持ち、道への投影はここで毎回行う。道の形を直しても境目の位置が
 * 道についてくるので、道の向き（始点が東か西か）にも左右されない。
 * 丁目は「どの道の、どの境目からどの境目まで」（chome_sections）で決める。
 *
 * 値（chome_boundaries / chome_sections）は DB のデータで、後から直せる。ここには持たない。
 */

type LatLng = { lat: number; lng: number };

export type ChomeConfidence = "confirmed" | "needs_review";

export type ChomeBoundary = {
  id: string;
  /** 交差点名（「廿代通り」など） */
  name: string;
  lat: number;
  lng: number;
  confidence: ChomeConfidence;
};

export type ChomeSection = {
  chomeId: ChomeId;
  roadId: string;
  /** 区間の両端の境目。null の側は道の端まで（境目が片方だけなら、境目から遠い側の道の端まで） */
  fromBoundaryId: string | null;
  toBoundaryId: string | null;
};

export type BoundaryProjection = {
  boundaryId: string;
  roadId: string;
  /** 道の始点からの距離（m） */
  distanceM: number;
  /** 境目の座標と、道の中心線とのずれ（m）。大きいときは座標か道の形を疑う */
  offsetM: number;
};

export type ChomeRange = {
  chomeId: ChomeId;
  roadId: string;
  startM: number;
  endM: number;
};

/** 境目のこの距離（m）以内の区画は、自動では決めず「要確認」にする */
export const CHOME_BOUNDARY_TOLERANCE_M = 2;

/** 境目の座標と道の中心線のずれがこれを超えたら報告する（m） */
export const CHOME_PROJECTION_WARN_M = 15;

export function buildChomeRanges(
  roads: ReadonlyMap<string, LatLng[]>,
  boundaries: readonly ChomeBoundary[],
  sections: readonly ChomeSection[]
): { ranges: ChomeRange[]; projections: BoundaryProjection[]; problems: string[] } {
  const boundaryById = new Map(boundaries.map((b) => [b.id, b]));
  const projections = new Map<string, BoundaryProjection>();
  const ranges: ChomeRange[] = [];
  const problems: string[] = [];

  const project = (roadId: string, boundaryId: string | null): BoundaryProjection | null => {
    if (!boundaryId) return null;
    const key = `${roadId}\u0000${boundaryId}`;
    const cached = projections.get(key);
    if (cached) return cached;
    const boundary = boundaryById.get(boundaryId);
    const points = roads.get(roadId);
    if (!boundary) {
      problems.push(`境目「${boundaryId}」が見つかりません`);
      return null;
    }
    if (!points) return null;
    const projected = projectOntoRoad(points, { lat: boundary.lat, lng: boundary.lng });
    if (!projected) return null;
    const result = { boundaryId, roadId, distanceM: projected.distanceM, offsetM: projected.lateralM };
    projections.set(key, result);
    return result;
  };

  for (const section of sections) {
    const points = roads.get(section.roadId);
    if (!points) {
      problems.push(`${section.chomeId}丁目の道「${section.roadId}」が見つかりません`);
      continue;
    }
    const length = roadLengthMeters(points);
    const a = project(section.roadId, section.fromBoundaryId);
    const b = project(section.roadId, section.toBoundaryId);
    if ((section.fromBoundaryId && !a) || (section.toBoundaryId && !b)) {
      problems.push(`${section.chomeId}丁目の境目を道に投影できません`);
      continue;
    }

    let startM: number;
    let endM: number;
    if (a && b) {
      startM = Math.min(a.distanceM, b.distanceM);
      endM = Math.max(a.distanceM, b.distanceM);
    } else if (a || b) {
      const d = (a ?? b)!.distanceM;
      // 境目が片方だけの区間（7丁目）は、境目から遠いほうの道の端までを区間にする
      [startM, endM] = d >= length - d ? [0, d] : [d, length];
    } else {
      [startM, endM] = [0, length];
    }
    ranges.push({ chomeId: section.chomeId, roadId: section.roadId, startM, endM });
  }

  return { ranges, projections: [...projections.values()], problems };
}

export type ChomeJudgement =
  | { status: "ok"; chomeId: ChomeId }
  /** 境目のすぐ上。どちらの丁目か自動では決めない */
  | { status: "near_boundary"; chomeId: null; candidates: ChomeId[] }
  /** どの丁目の区間にも入らない（道の端の外・区間のない道） */
  | { status: "outside"; chomeId: null }
  /** 区間が重なっていて 1 つに決まらない（設定の誤り） */
  | { status: "ambiguous"; chomeId: null; candidates: ChomeId[] };

/** 区画の位置（道と、始点からの距離）から丁目を決める */
export function judgeChome(
  ranges: readonly ChomeRange[],
  projections: readonly BoundaryProjection[],
  slot: { roadId: string; distanceM: number },
  toleranceM: number = CHOME_BOUNDARY_TOLERANCE_M
): ChomeJudgement {
  const onRoad = ranges.filter((r) => r.roadId === slot.roadId);
  const inside = onRoad.filter((r) => slot.distanceM >= r.startM && slot.distanceM <= r.endM);

  const nearBoundary = projections.some(
    (p) => p.roadId === slot.roadId && Math.abs(p.distanceM - slot.distanceM) <= toleranceM
  );
  if (nearBoundary) {
    // 境目の両側の丁目（許容の範囲に入る区間）を候補として返す
    const candidates = onRoad
      .filter((r) => slot.distanceM >= r.startM - toleranceM && slot.distanceM <= r.endM + toleranceM)
      .map((r) => r.chomeId);
    return { status: "near_boundary", chomeId: null, candidates: [...new Set(candidates)] };
  }

  if (inside.length === 0) return { status: "outside", chomeId: null };
  if (inside.length > 1) return { status: "ambiguous", chomeId: null, candidates: inside.map((r) => r.chomeId) };
  return { status: "ok", chomeId: inside[0].chomeId };
}

/** 道の上の距離から座標を求める（管理画面で境目を線で描くとき用） */
export function chomeBoundaryLatLng(points: LatLng[], distanceM: number): LatLng {
  const { lat, lng } = pointAlongRoad(points, distanceM);
  return { lat, lng };
}
