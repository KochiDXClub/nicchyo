/**
 * 現在地から一番近い施設を求める
 *
 * 距離は「通り沿いの道すじ」（buildRouteAlongRoad）の長さで測る。
 * センターラインが渡されない場合は直線距離に迂回係数をかけて代用する。
 */

import type { Facility, FacilityCategoryId } from './facilities';
import { FACILITIES } from './facilities';
import { distanceInMeters, type LatLng } from './geo';
import { buildRouteAlongRoad, type FacilityRoute } from './route';

export type { LatLng } from './geo';
export { distanceInMeters } from './geo';

export type FacilityWithRoute = {
  facility: Facility;
  /** 道のりの見積もり（メートル） */
  walkDistanceMeters: number;
  /** 徒歩の推定所要時間（分） */
  walkMinutes: number;
  /** マップに描く道すじ。センターラインが無いときは現在地と施設を直線で結ぶ */
  route: FacilityRoute;
};

/** 分速（メートル）。日曜市は人が多く、ゆっくり歩く前提で控えめに設定 */
export const WALK_SPEED_METERS_PER_MINUTE = 70;

/** センターラインが無いとき、直線距離を道のりに近づけるための係数 */
export const DETOUR_RATIO = 1.3;

/** 道のり（メートル）から徒歩の推定所要時間（分）を求める。最低1分 */
export function estimateWalkMinutes(walkDistanceMeters: number): number {
  return Math.max(1, Math.round(walkDistanceMeters / WALK_SPEED_METERS_PER_MINUTE));
}

/**
 * 指定カテゴリの施設を、現在地からの道のりが近い順に並べて返す。
 *
 * @param centerline 追手筋のセンターライン。渡すと道なりの道すじで距離を測る
 */
export function rankFacilitiesByWalk(
  origin: LatLng,
  category: FacilityCategoryId,
  facilities: Facility[] = FACILITIES,
  centerline: LatLng[] = []
): FacilityWithRoute[] {
  return facilities
    .filter((facility) => facility.category === category)
    .map((facility) => {
      let route: FacilityRoute;
      let walkDistanceMeters: number;

      if (centerline.length >= 2) {
        route = buildRouteAlongRoad(origin, facility, centerline);
        walkDistanceMeters = route.distanceMeters;
      } else {
        walkDistanceMeters = distanceInMeters(origin, facility) * DETOUR_RATIO;
        route = {
          points: [origin, { lat: facility.lat, lng: facility.lng }],
          distanceMeters: walkDistanceMeters,
        };
      }

      return {
        facility,
        walkDistanceMeters,
        walkMinutes: estimateWalkMinutes(walkDistanceMeters),
        route,
      };
    })
    .sort((a, b) => a.walkDistanceMeters - b.walkDistanceMeters);
}

/**
 * 指定カテゴリのうち現在地から一番近い施設を返す。
 * 該当する施設が無ければ null。
 */
export function findNearestFacility(
  origin: LatLng,
  category: FacilityCategoryId,
  facilities: Facility[] = FACILITIES,
  centerline: LatLng[] = []
): FacilityWithRoute | null {
  return rankFacilitiesByWalk(origin, category, facilities, centerline)[0] ?? null;
}

/** 距離を「約120m」「約1.2km」の形に整える */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `約${(meters / 1000).toFixed(1)}km`;
  }
  return `約${Math.round(meters / 10) * 10}m`;
}
