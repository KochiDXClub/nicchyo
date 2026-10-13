import { findNearestRoadId, latToMeters, lngToMeters, metersToLat, metersToLng } from "@/app/(public)/map/utils/mapRouteGeometry";
import type { MapRoutePoint } from "@/app/(public)/map/types/mapRoute";

/**
 * 区画の「道基準の位置」と緯度経度の相互変換。
 *
 * 区画は「道のID・道の始点からの距離（m）・左右どちら側か・道の中心線からの距離（m）」で
 * 位置を持つ。道の形を直したら、この値から緯度経度を計算し直すことで区画がついてくる。
 * 左右は道の点の並び（始点 → 終点）に向かって見た向き。
 *
 * マップ編集画面（クライアント）と保存 API（サーバー）の両方がこのファイルを使う
 * （別々に実装すると、画面に見えている位置と保存される位置がずれるため）。
 */

export type RoadSide = "left" | "right";

export type RoadSlotPosition = {
  /** 道の始点からの距離（m） */
  distanceM: number;
  side: RoadSide;
  /** 道の中心線からの距離（m、0以上） */
  offsetM: number;
};

type LatLng = { lat: number; lng: number };

type Segment = {
  a: LatLng;
  /** a → b のベクトル（ローカルのメートル座標。東 = x、北 = y） */
  dx: number;
  dy: number;
  length: number;
  /** 道の始点からこの区間の始まりまでの距離 */
  startDistance: number;
};

function buildSegments(points: LatLng[]): Segment[] {
  const segments: Segment[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = lngToMeters(b.lng - a.lng, a.lat);
    const dy = latToMeters(b.lat - a.lat);
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;
    segments.push({ a, dx, dy, length, startDistance: total });
    total += length;
  }
  return segments;
}

/** 道の長さ（m）。点の並び順どおりにつないだ折れ線の長さ */
export function roadLengthMeters(points: LatLng[]): number {
  return buildSegments(points).reduce((sum, segment) => sum + segment.length, 0);
}

/**
 * 道の始点から distanceM の地点と、そこでの左向きの単位ベクトル（ローカルのメートル座標）。
 * 道の長さを超える距離は終点に、負の距離は始点に丸める。
 */
export function pointAlongRoad(points: LatLng[], distanceM: number): LatLng & { leftX: number; leftY: number } {
  const segments = buildSegments(points);
  if (segments.length === 0) {
    const p = points[0] ?? { lat: 0, lng: 0 };
    return { lat: p.lat, lng: p.lng, leftX: 0, leftY: 1 };
  }
  const total = segments[segments.length - 1].startDistance + segments[segments.length - 1].length;
  const d = Math.min(Math.max(distanceM, 0), total);
  const segment =
    segments.find((s) => d <= s.startDistance + s.length) ?? segments[segments.length - 1];
  const f = (d - segment.startDistance) / segment.length;
  const east = segment.dx * f;
  const north = segment.dy * f;
  const lat = segment.a.lat + metersToLat(north);
  const lng = segment.a.lng + metersToLng(east, segment.a.lat);
  // 進行方向 (dx, dy) を反時計回りに90度回すと左向き
  return { lat, lng, leftX: -segment.dy / segment.length, leftY: segment.dx / segment.length };
}

/** 道基準の位置 → 緯度経度 */
export function roadSlotLatLng(points: LatLng[], position: RoadSlotPosition): LatLng {
  const at = pointAlongRoad(points, position.distanceM);
  const sign = position.side === "left" ? 1 : -1;
  const east = at.leftX * position.offsetM * sign;
  const north = at.leftY * position.offsetM * sign;
  return { lat: at.lat + metersToLat(north), lng: at.lng + metersToLng(east, at.lat) };
}

/**
 * 緯度経度 → 道基準の位置（その道の上で最も近い地点に投影する）。
 * lateralM は道の中心線（折れ線）までの距離。道の端より外に出ている点は
 * 端の地点からの距離になり、roadSlotLatLng で戻すと元の位置とずれる。
 * そのずれを driftM で返す（移行処理の報告に使う）。
 */
export function projectOntoRoad(
  points: LatLng[],
  point: LatLng
): (RoadSlotPosition & { lateralM: number; driftM: number }) | null {
  const segments = buildSegments(points);
  if (segments.length === 0) return null;

  let best: { distanceM: number; cross: number; lateralM: number } | null = null;
  for (const segment of segments) {
    const px = lngToMeters(point.lng - segment.a.lng, segment.a.lat);
    const py = latToMeters(point.lat - segment.a.lat);
    const t = Math.min(Math.max((px * segment.dx + py * segment.dy) / (segment.length * segment.length), 0), 1);
    const cx = segment.dx * t;
    const cy = segment.dy * t;
    const lateralM = Math.hypot(px - cx, py - cy);
    if (!best || lateralM < best.lateralM) {
      best = {
        distanceM: segment.startDistance + segment.length * t,
        // 進行方向に対して左にあれば正
        cross: segment.dx * py - segment.dy * px,
        lateralM,
      };
    }
  }
  if (!best) return null;

  const position: RoadSlotPosition = {
    distanceM: best.distanceM,
    side: best.cross >= 0 ? "left" : "right",
    offsetM: best.lateralM,
  };
  const restored = roadSlotLatLng(points, position);
  const driftM = Math.hypot(
    lngToMeters(restored.lng - point.lng, point.lat),
    latToMeters(restored.lat - point.lat)
  );
  return { ...position, lateralM: best.lateralM, driftM };
}

/** 区画が道基準の位置を持っていれば、その道の形から緯度経度を求める。持っていなければ null */
export function resolveSlotLatLng(
  slot: { roadId?: string | null; roadDistanceM?: number | null; roadSide?: RoadSide | null; roadOffsetM?: number | null },
  roadPointsById: ReadonlyMap<string, LatLng[]>
): LatLng | null {
  if (!slot.roadId || slot.roadDistanceM == null || !slot.roadSide || slot.roadOffsetM == null) return null;
  const points = roadPointsById.get(slot.roadId);
  if (!points || points.length < 2) return null;
  return roadSlotLatLng(points, { distanceM: slot.roadDistanceM, side: slot.roadSide, offsetM: slot.roadOffsetM });
}

type SlotLike = {
  lat: number;
  lng: number;
  roadId?: string | null;
  roadDistanceM?: number | null;
  roadSide?: RoadSide | null;
  roadOffsetM?: number | null;
};

/**
 * 区画が乗っている道の id。道基準の位置を持つ区画はその道、持たない区画（移行前）は
 * 緯度経度から最も近い道（snapDistanceMeters 以内）。マップ編集の画面と保存 API の
 * 両方が同じ判定を使う（別々に実装すると、画面の表示と保存時の検証がずれるため）。
 */
export function roadIdOfSlot(
  slot: SlotLike,
  roads: { id: string; points: MapRoutePoint[] }[],
  snapDistanceMeters: number
): string | null {
  return slot.roadId ?? findNearestRoadId({ lat: slot.lat, lng: slot.lng }, roads, snapDistanceMeters);
}

/**
 * 道基準の位置を持つ区画の緯度経度を、道の形から計算し直す。
 * 位置を持たない区画、参照先の道が見つからない区画はそのまま返す。
 */
export function resolveSlotPositions<T extends SlotLike>(slots: T[], roads: { id: string; points: LatLng[] }[]): T[] {
  const pointsByRoadId = new Map(roads.map((road) => [road.id, road.points]));
  return slots.map((slot) => {
    const resolved = resolveSlotLatLng(slot, pointsByRoadId);
    return resolved && (resolved.lat !== slot.lat || resolved.lng !== slot.lng) ? { ...slot, ...resolved } : slot;
  });
}
