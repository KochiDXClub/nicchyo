/**
 * 実座標を、案内パネルのデモの枠（px）に収める小さな投影。
 *
 * 地図ライブラリを載せずに「本番の場所に本番の印が立っている」を見せるためのもの。
 * 会場は 1km 四方に満たないので、緯度経度をメートルに直して平行移動・回転・
 * 拡大するだけで、地図と見比べても違和感のない位置になる。
 *
 * 向きは本番の地図と同じにする。本番は道（追手筋）が画面の縦になるよう地図を
 * 回している（MapViewMapLibre の computeRoadBearing）。ここでも「上にする方位」を
 * 受け取り、その方位が画面の上を向くように回す。
 */

import type { LatLng } from '@/lib/facilities/geo';
import { bearingDegrees } from '@/lib/guide';

export type FramePoint = { x: number; y: number };

export type MiniMapPadding = { top: number; right: number; bottom: number; left: number };

export type MiniMapProjection = {
  project: (point: LatLng) => FramePoint;
  /** 1m が何 px か */
  pxPerMeter: number;
};

/** 緯度1度あたりのメートル。会場の緯度（北緯33.5度）ではこの近似で十分 */
const METERS_PER_DEGREE_LAT = 111_320;

/**
 * 「上にする方位」を道の向きから決める（北=0、時計回り）。
 * 本番の地図は「道の進行方向 + 180°」を上にしている（西＝高知城側が上）ので、
 * 同じ向きに合わせる。道が1点しか無ければ北を上にする
 */
export function roadUpBearing(road: LatLng[]): number {
  if (road.length < 2) return 0;
  const compass = bearingDegrees(road[0], road[road.length - 1]);
  return (compass + 180) % 360;
}

/**
 * 収めたい点（fit）がすべて余白の内側に入り、縦横の縮尺が同じになる投影を作る。
 * 余白は、上に重なる案内カードや、印の下に出る名札のぶんを空けるためのもの。
 */
export function createMiniMapProjection(options: {
  upBearing: number;
  fit: LatLng[];
  width: number;
  height: number;
  padding: MiniMapPadding;
}): MiniMapProjection {
  const { upBearing, fit, width, height, padding } = options;
  const reference = fit[0] ?? { lat: 0, lng: 0 };
  const cosLat = Math.cos((reference.lat * Math.PI) / 180);
  const theta = (upBearing * Math.PI) / 180;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);

  /** 基準点からの東・北の距離（m）を、upBearing が上になるよう回して画面の向きにする */
  const toLocal = (point: LatLng): FramePoint => {
    const east = (point.lng - reference.lng) * METERS_PER_DEGREE_LAT * cosLat;
    const north = (point.lat - reference.lat) * METERS_PER_DEGREE_LAT;
    const right = east * cos - north * sin;
    const up = east * sin + north * cos;
    return { x: right, y: -up };
  };

  const locals = fit.map(toLocal);
  const minX = Math.min(...locals.map((p) => p.x));
  const maxX = Math.max(...locals.map((p) => p.x));
  const minY = Math.min(...locals.map((p) => p.y));
  const maxY = Math.max(...locals.map((p) => p.y));
  // 点が1つ・一直線のときも縮尺が無限にならないよう、広がりは最低 1m とみなす
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);

  const innerWidth = Math.max(1, width - padding.left - padding.right);
  const innerHeight = Math.max(1, height - padding.top - padding.bottom);
  const pxPerMeter = Math.min(innerWidth / spanX, innerHeight / spanY);

  // 余白の内側の真ん中に寄せる（広がりは実際の値で。点が1つなら中央に来る）
  const offsetX = padding.left + (innerWidth - (maxX - minX) * pxPerMeter) / 2;
  const offsetY = padding.top + (innerHeight - (maxY - minY) * pxPerMeter) / 2;

  return {
    pxPerMeter,
    project: (point) => {
      const local = toLocal(point);
      return {
        x: offsetX + (local.x - minX) * pxPerMeter,
        y: offsetY + (local.y - minY) * pxPerMeter,
      };
    },
  };
}
