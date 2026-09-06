/**
 * 人影（お客さん）の配置計算
 *
 * 道の中心線に沿って、シード付き擬似乱数で決定論的に人影を散らす。
 * 毎回ランダムに振り直すと再描画のたびに人がワープして安っぽくなるので、
 * 同じ道・同じシードなら必ず同じ並びになるようにする
 * （utils/zoomCalculator.ts のハッシュベースの間引きと同じ発想）。
 *
 * 人が歩くのは道の真ん中。屋台は道の両脇に並ぶので、左右に寄せすぎると屋台に重なる。
 */

import type { MapRoutePoint } from "../types/mapRoute";
import { CROWD_KINDS, type CrowdKind } from "../config/crowdParts";
import {
  densifyPath,
  distanceMeters,
  getRouteChains,
  metersToLat,
  metersToLng,
  smoothRoutePath,
} from "./mapRouteGeometry";

export interface CrowdPerson {
  lat: number;
  lng: number;
  kind: CrowdKind;
  /** 左右反転（0 = そのまま、1 = 反転） */
  flip: 0 | 1;
  /** 歩きのコマの初期位相。全員が同時に同じ動きをする「波」を防ぐ */
  phase: 0 | 1;
}

export interface CrowdPlacementOptions {
  /** 道 100m あたりの人数 */
  perHundredMeters?: number;
  /** 道の半幅（m）。人はこの内側の中央寄りにだけ立つ */
  halfWidthMeters: number;
  /** 擬似乱数のシード。同じ値なら同じ配置になる */
  seed?: number;
  /** 上限（道が長いときに増えすぎないようにする） */
  maxPeople?: number;
}

/** 既定の密度。まばらに見えて「にぎわい」は伝わる程度 */
export const DEFAULT_CROWD_PER_100M = 18;
/** 人影の上限。GPU 側は余裕だが、絵として多すぎると主役の屋台がかすむ */
export const DEFAULT_MAX_CROWD = 260;

/** 人の立ち位置を道幅のどこまで許すか（1.0 だと道の縁＝屋台の足元に重なる） */
const LATERAL_RATIO = 0.62;

/** 種類ごとの出やすさ。大人と買い物客が多数派 */
const KIND_WEIGHTS: Record<CrowdKind, number> = {
  adult: 0.38,
  shopper: 0.3,
  child: 0.16,
  granny: 0.16,
};

/** mulberry32。短く決定論的で、シードを変えれば並びも変わる */
function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickKind(r: number): CrowdKind {
  let acc = 0;
  for (const kind of CROWD_KINDS) {
    acc += KIND_WEIGHTS[kind];
    if (r < acc) return kind;
  }
  return CROWD_KINDS[0];
}

interface Segment {
  from: [number, number];
  to: [number, number];
  length: number;
  /** 道の始点からの累積距離（m） */
  offset: number;
}

/**
 * 道の中心線をひとつながりの線分列にする。
 * MapViewMapLibre が道を描くときと同じ密度・平滑化を通し、絵の道の上に確実に乗せる。
 */
function buildSegments(routePoints: MapRoutePoint[]): { segments: Segment[]; total: number } {
  const segments: Segment[] = [];
  let total = 0;
  for (const chain of getRouteChains(routePoints)) {
    const anchor = chain.points.map((p) => ({ lat: p.lat, lng: p.lng }));
    const dense = densifyPath(anchor, 6);
    const path = chain.points.length >= 3 ? smoothRoutePath(dense, 2) : dense;
    for (let i = 0; i < path.length - 1; i += 1) {
      const from = path[i];
      const to = path[i + 1];
      const length = distanceMeters(
        { lat: from[0], lng: from[1] },
        { lat: to[0], lng: to[1] }
      );
      if (length <= 0) continue;
      segments.push({ from, to, length, offset: total });
      total += length;
    }
  }
  return { segments, total };
}

/** 累積距離 d（m）の地点と、そこでの進行方向の単位ベクトル（m 換算） */
function locate(
  segments: Segment[],
  d: number
): { lat: number; lng: number; nx: number; ny: number } | null {
  if (segments.length === 0) return null;
  let index = segments.findIndex((s) => d < s.offset + s.length);
  if (index < 0) index = segments.length - 1;
  const seg = segments[index];
  const t = Math.min(1, Math.max(0, (d - seg.offset) / seg.length));
  const lat = seg.from[0] + (seg.to[0] - seg.from[0]) * t;
  const lng = seg.from[1] + (seg.to[1] - seg.from[1]) * t;
  // 進行方向（m 換算）→ その法線
  const dy = (seg.to[0] - seg.from[0]) * 110540;
  const dx = (seg.to[1] - seg.from[1]) * 111320 * Math.cos((lat * Math.PI) / 180);
  const len = Math.hypot(dx, dy) || 1;
  return { lat, lng, nx: -dy / len, ny: dx / len };
}

/**
 * 道の上に人影を散らす。
 * 等間隔に区切ったうえで区間内をずらすことで、行列にも団子にもならない間隔になる。
 */
export function buildCrowdPeople(
  routePoints: MapRoutePoint[],
  options: CrowdPlacementOptions
): CrowdPerson[] {
  const { segments, total } = buildSegments(routePoints);
  if (segments.length === 0 || total <= 0) return [];

  const perHundred = options.perHundredMeters ?? DEFAULT_CROWD_PER_100M;
  const max = options.maxPeople ?? DEFAULT_MAX_CROWD;
  const count = Math.min(max, Math.max(0, Math.round((total / 100) * perHundred)));
  if (count === 0) return [];

  const random = createRandom(options.seed ?? 20260906);
  const lateralLimit = Math.max(0, options.halfWidthMeters * LATERAL_RATIO);
  const spacing = total / count;
  const people: CrowdPerson[] = [];

  for (let i = 0; i < count; i += 1) {
    // 区間の中央から ±40% だけずらす（等間隔の行列に見せない）
    const along = (i + 0.5 + (random() - 0.5) * 0.8) * spacing;
    const point = locate(segments, Math.min(total, Math.max(0, along)));
    if (!point) continue;
    const lateral = (random() * 2 - 1) * lateralLimit;
    people.push({
      lat: point.lat + metersToLat(point.ny * lateral),
      lng: point.lng + metersToLng(point.nx * lateral, point.lat),
      kind: pickKind(random()),
      flip: random() < 0.5 ? 0 : 1,
      phase: random() < 0.5 ? 0 : 1,
    });
  }

  // 奥（北）から手前（南）の順に並べ、重なったときに手前の人が上に来るようにする
  people.sort((a, b) => b.lat - a.lat);
  return people;
}

export function crowdToGeoJSON(people: CrowdPerson[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: people.map((person, index) => ({
      type: "Feature",
      id: index,
      geometry: { type: "Point", coordinates: [person.lng, person.lat] },
      properties: {
        kind: person.kind,
        flip: person.flip,
        phase: person.phase,
      },
    })),
  };
}
