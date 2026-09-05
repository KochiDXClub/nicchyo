/**
 * 案内の起点
 *
 * 位置情報が取れないときでも案内が成立するよう、起点を抽象化する。
 *   geolocation : 端末の現在地（会場内で取れているとき）
 *   map-center  : いま見ている地図の中心（位置情報が無い・許可されていないとき）
 *   spot        : 選んだスポットや店（「はりまや橋停留場から」など）
 *   venue       : 会場（追手筋）の中心。最後のフォールバック
 */

import type { LatLng } from '@/lib/facilities/geo';
import type { GuideOrigin } from './types';

/** 追手筋の中心付近（UserLocationMarker の MARKET_CENTER と同じ） */
export const VENUE_CENTER: LatLng = { lat: 33.5614118, lng: 133.5379706 };

export function geolocationOrigin(point: LatLng, accuracyMeters?: number): GuideOrigin {
  return { type: 'geolocation', point, label: '現在地', accuracyMeters };
}

export function mapCenterOrigin(point: LatLng): GuideOrigin {
  return { type: 'map-center', point, label: '地図の中心' };
}

export function spotOrigin(spot: { id: string; name: string; lat: number; lng: number }): GuideOrigin {
  return { type: 'spot', point: { lat: spot.lat, lng: spot.lng }, label: spot.name, spotId: spot.id };
}

export function venueOrigin(): GuideOrigin {
  return { type: 'venue', point: VENUE_CENTER, label: '日曜市の中心' };
}

/** 起点の種類ごとに、案内文の頭につける言い回し */
export function describeOrigin(origin: GuideOrigin): string {
  switch (origin.type) {
    case 'geolocation':
      return '現在地から';
    case 'map-center':
      return '地図の中心から';
    case 'spot':
      return `${origin.label}から`;
    case 'venue':
      return '日曜市の中心から';
  }
}

/**
 * 起点を優先順で決める。
 * 現在地 → 地図の中心 → 会場の中心。現在地は「会場内で取れている」ときだけ使う
 * （測位失敗時のフォールバック座標をそのまま使うと最寄りを断定してしまうため）。
 */
export function resolveOrigin(input: {
  geolocation?: { point: LatLng; inMarket: boolean; accuracyMeters?: number } | null;
  mapCenter?: LatLng | null;
  spot?: { id: string; name: string; lat: number; lng: number } | null;
}): GuideOrigin {
  if (input.spot) return spotOrigin(input.spot);
  if (input.geolocation?.inMarket) return geolocationOrigin(input.geolocation.point, input.geolocation.accuracyMeters);
  if (input.mapCenter) return mapCenterOrigin(input.mapCenter);
  return venueOrigin();
}
