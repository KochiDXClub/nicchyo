import {
  latToMeters,
  lngToMeters,
  metersToLat,
  metersToLng,
} from "../../map/utils/mapRouteGeometry";

/**
 * 緯度経度と、原点を中心としたローカルなメートル座標（SVG描画用）を
 * 相互変換するためのユーティリティ。
 *
 * SVGはy軸が下向きなので、緯度（北が正）とは符号を反転させる。
 */
export type LocalPoint = { x: number; y: number };

export function createProjection(originLat: number, originLng: number) {
  const toLocal = (lat: number, lng: number): LocalPoint => ({
    x: lngToMeters(lng - originLng, originLat),
    y: -latToMeters(lat - originLat),
  });

  const toLatLng = (point: LocalPoint): { lat: number; lng: number } => ({
    lat: originLat + metersToLat(-point.y),
    lng: originLng + metersToLng(point.x, originLat),
  });

  return { toLocal, toLatLng };
}

export type Projection = ReturnType<typeof createProjection>;
