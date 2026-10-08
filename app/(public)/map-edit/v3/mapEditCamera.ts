/**
 * MapEditCanvasMapLibre 用のカメラ変換。
 *
 * MapEditClientV3 が持つカメラ状態（zoomIdx: 旧SVGキャンバスの ZOOMS=[1.2,3.5,12]（px/m）の
 * インデックス、rotation: 度）は、保存・スナップショット復元・矢印キー/WASDでの区画ナビゲーション
 * など、キャンバス実装に依存しない広い範囲から参照されている。ここをMapLibreネイティブの
 * center/zoom/bearingに置き換えると変更が波及しすぎるため、外側の契約（zoomIdx/rotation）は
 * そのままとし、MapLibreとの相互変換だけをこのファイルに閉じ込める。
 */

/** 日曜市会場の中心緯度（config/roadConfig.ts の ROAD_CONFIG.centerLine と同じ） */
const REFERENCE_LAT = 33.5614118;

/**
 * 「1メートルが何スクリーンpxか」から、同じ見た目になるMapLibreズーム値を求める。
 *
 * MapLibreは512pxタイル基準なので、256pxタイル基準で求めた値より1小さくする
 * （公開マップ側 ZOOM_OFFSET と同じ考え方。MapViewMapLibre.tsx 参照）。
 */
function pixelsPerMeterToMapLibreZoom(pixelsPerMeter: number, lat: number = REFERENCE_LAT): number {
  const metersPerPixelAtZoom0 = 156543.03392 * Math.cos((lat * Math.PI) / 180);
  const leafletZoom = Math.log2(pixelsPerMeter * metersPerPixelAtZoom0);
  return leafletZoom - 1;
}

/** 旧キャンバスの ZOOMS=[1.2, 3.5, 12]（px/m）に対応するMapLibreズーム値の3段階 */
export const MAPLIBRE_ZOOMS: readonly [number, number, number] = [1.2, 3.5, 12].map((ppm) =>
  pixelsPerMeterToMapLibreZoom(ppm)
) as [number, number, number];

/** zoomIdx（0〜2）→ 対応するMapLibreズーム値。範囲外は端に丸める */
export function zoomIdxToMapLibreZoom(idx: number): number {
  const clamped = Math.max(0, Math.min(MAPLIBRE_ZOOMS.length - 1, Math.round(idx)));
  return MAPLIBRE_ZOOMS[clamped];
}

/**
 * ホイール・ピンチでの連続ズーム後、MapLibreの現在のズーム値から最も近い zoomIdx を求める。
 * showNumbers/showDots のLOD判定は zoomIdx の段階で行っているため、
 * moveend/zoomend のたびにこれで丸めて zoomIdx を更新する。
 */
export function nearestZoomIdx(zoom: number): number {
  let bestIdx = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  MAPLIBRE_ZOOMS.forEach((z, idx) => {
    const diff = Math.abs(z - zoom);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIdx = idx;
    }
  });
  return bestIdx;
}

/**
 * rotation（度、CSSの rotate() と同じく画面上で時計回りが正。旧キャンバスは
 * コンテンツに直接 rotate(rotation deg) をかけている）と、MapLibreの bearing
 * （コンパス方位。北を0として時計回りが正で、bearingを増やすとカメラが時計回りに
 * 回転する＝地図コンテンツは反時計回りに回って見える）は、コンテンツの見た目の
 * 回転方向が逆になるため符号を反転して変換する。
 */
export function rotationToBearing(rotationDeg: number): number {
  return -rotationDeg;
}

export function bearingToRotation(bearingDeg: number): number {
  return -bearingDeg;
}
