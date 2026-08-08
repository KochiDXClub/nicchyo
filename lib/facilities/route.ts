/**
 * 施設までの道すじを組み立てる
 *
 * 外部のルート検索APIは使わず、日曜市の会場である追手筋のセンターライン
 * （app/(public)/map/config/roadConfig.ts が持つ実座標）に沿わせることで
 * 「道なり」の道すじを作る。
 *
 *   現在地 → 追手筋に出る → 追手筋を歩く → 施設のいちばん近くで折れる → 施設
 *
 * 会場は一本道なので、この組み立てで実際の歩き方にかなり近くなる。
 * センターラインから大きく離れた施設（JR高知駅など）でも、
 * 少なくとも「通りに出てから向かう」形にはなる。
 */

import { distanceInMeters, type LatLng } from './geo';

export type FacilityRoute = {
  /** 現在地から施設までの折れ線 */
  points: LatLng[];
  /** 折れ線の長さ（メートル）＝道のりの見積もり */
  distanceMeters: number;
};

type Projection = {
  point: LatLng;
  /** どの区間に落ちたか（0始まり） */
  segmentIndex: number;
  /** 区間内の位置（0〜1） */
  t: number;
  distanceMeters: number;
};

/** 点を折れ線に投影し、最も近い位置を返す */
export function projectOntoPolyline(target: LatLng, polyline: LatLng[]): Projection | null {
  if (polyline.length === 0) return null;
  if (polyline.length === 1) {
    return {
      point: polyline[0],
      segmentIndex: 0,
      t: 0,
      distanceMeters: distanceInMeters(target, polyline[0]),
    };
  }

  let best: Projection | null = null;

  for (let i = 0; i < polyline.length - 1; i += 1) {
    const a = polyline[i];
    const b = polyline[i + 1];
    const abLat = b.lat - a.lat;
    const abLng = b.lng - a.lng;
    const lengthSq = abLat * abLat + abLng * abLng;

    let t = 0;
    if (lengthSq > 0) {
      const rawT = ((target.lat - a.lat) * abLat + (target.lng - a.lng) * abLng) / lengthSq;
      t = Math.max(0, Math.min(1, rawT));
    }

    const point: LatLng = { lat: a.lat + abLat * t, lng: a.lng + abLng * t };
    const distance = distanceInMeters(target, point);

    if (!best || distance < best.distanceMeters) {
      best = { point, segmentIndex: i, t, distanceMeters: distance };
    }
  }

  return best;
}

/** ほぼ同じ地点が続くときに折れ線から間引く（1m未満） */
function dedupe(points: LatLng[]): LatLng[] {
  return points.filter(
    (point, index) => index === 0 || distanceInMeters(points[index - 1], point) >= 1
  );
}

/** 折れ線の全長（メートル） */
export function polylineLength(points: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += distanceInMeters(points[i], points[i + 1]);
  }
  return total;
}

/**
 * 通り沿いの道すじを組み立てる。
 * centerline が空、または通りから遠すぎる場合は直線でつなぐ。
 */
export function buildRouteAlongRoad(
  origin: LatLng,
  destination: LatLng,
  centerline: LatLng[]
): FacilityRoute {
  const straight = (): FacilityRoute => {
    const points = dedupe([origin, destination]);
    return { points, distanceMeters: polylineLength(points) };
  };

  if (centerline.length < 2) return straight();

  const from = projectOntoPolyline(origin, centerline);
  const to = projectOntoPolyline(destination, centerline);
  if (!from || !to) return straight();

  // 通りに出てから戻るほうが遠回りになる場合（＝どちらも通りのすぐそば同士でない）は
  // 直線のほうが実態に近いので、そのまま直線にする
  const viaRoadIsDetour =
    from.distanceMeters + to.distanceMeters > distanceInMeters(origin, destination) * 2;
  if (viaRoadIsDetour) return straight();

  // 通り上を from → to までたどる
  const between: LatLng[] = [];
  const forward =
    from.segmentIndex < to.segmentIndex ||
    (from.segmentIndex === to.segmentIndex && from.t <= to.t);

  if (forward) {
    for (let i = from.segmentIndex + 1; i <= to.segmentIndex; i += 1) {
      between.push(centerline[i]);
    }
  } else {
    for (let i = from.segmentIndex; i > to.segmentIndex; i -= 1) {
      between.push(centerline[i]);
    }
  }

  const points = dedupe([origin, from.point, ...between, to.point, destination]);
  return { points, distanceMeters: polylineLength(points) };
}
