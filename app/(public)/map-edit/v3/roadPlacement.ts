import {
  distanceMeters,
  latToMeters,
  lngToMeters,
  metersToLat,
  metersToLng,
} from "../../map/utils/mapRouteGeometry";
import type { MapRoutePoint } from "../../map/types/mapRoute";

export type RoadPointAt = {
  lat: number;
  lng: number;
  /** 進行方向に対して垂直な単位ベクトル（ローカルメートル空間、東=x・北=y） */
  nx: number;
  ny: number;
};

/**
 * 道の折れ線上、始点からの累積距離割合 t（0〜1）にあたる緯度経度と、
 * その地点での進行方向に垂直な単位ベクトルを返す。
 * 区画レーンでの新規区画配置（区画を道に沿って等間隔に置く）に使う。
 */
export function pointAtT(points: MapRoutePoint[], t: number): RoadPointAt {
  if (points.length === 0) {
    return { lat: 0, lng: 0, nx: 0, ny: 1 };
  }
  if (points.length === 1) {
    return { lat: points[0].lat, lng: points[0].lng, nx: 0, ny: 1 };
  }

  const segments = points.slice(0, -1).map((point, index) => ({
    a: point,
    b: points[index + 1],
    len: distanceMeters(point, points[index + 1]),
  }));
  const total = segments.reduce((sum, seg) => sum + seg.len, 0) || 1;
  let remaining = Math.max(0, Math.min(1, t)) * total;

  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const isLast = i === segments.length - 1;
    if (remaining <= seg.len || isLast) {
      const f = seg.len ? remaining / seg.len : 0;
      const lat = seg.a.lat + (seg.b.lat - seg.a.lat) * f;
      const lng = seg.a.lng + (seg.b.lng - seg.a.lng) * f;
      const tangentX = lngToMeters(seg.b.lng - seg.a.lng, lat);
      const tangentY = latToMeters(seg.b.lat - seg.a.lat);
      const tangentLen = Math.hypot(tangentX, tangentY) || 1;
      return {
        lat,
        lng,
        nx: -tangentY / tangentLen,
        ny: tangentX / tangentLen,
      };
    }
    remaining -= seg.len;
  }

  const last = points[points.length - 1];
  return { lat: last.lat, lng: last.lng, nx: 0, ny: 1 };
}

/**
 * 緯度経度を、ローカルメートル空間の単位ベクトル(nx, ny)方向に
 * offsetMeters だけずらした地点を返す。
 */
export function offsetLatLng(
  base: { lat: number; lng: number },
  nx: number,
  ny: number,
  offsetMeters: number
): { lat: number; lng: number } {
  return {
    lat: base.lat + metersToLat(ny * offsetMeters),
    lng: base.lng + metersToLng(nx * offsetMeters, base.lat),
  };
}
