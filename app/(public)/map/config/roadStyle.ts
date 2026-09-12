/**
 * 道の見た目（色・線幅）の唯一の定義元。
 *
 * Leaflet 版（components/RoadOverlay.tsx）と MapLibre 版
 * （components/maplibre/MapViewMapLibre.tsx）は同じ道を別々のライブラリで描く。
 * 以前は色も線幅も両方に直書きしていたため、片方だけ直すと見た目がズレた。
 * 見た目に関わる値はすべてここに集約し、両方がここを参照する。
 *
 * 【塗り分けの考え方】
 * 道を1色のベタで塗るのをやめ、「グレー＝地面が見えている＝通り抜ける場所」
 * 「暖色＝店が並ぶ場所」というルールで塗り分ける。
 * 日曜市の当日、屋台が並ぶ両脇はテント・商品・人で覆われてアスファルトが見えない。
 * 一方で中央は来訪者が歩く通路で、実際にアスファルトが見えている。
 * 塗り分けることで「真ん中を歩けばいい」が説明なしで伝わる。
 */

export const ROAD_STYLE = {
  /** 屋台が並ぶ両脇の帯。テント・商品・人で覆われている前提の暖色 */
  surfaceColor: '#d9c7a8',
  /** 中央の通路。アスファルトが見えているので彩度を落とす */
  corridorColor: '#cfc8bc',
  /** 道の縁（両サイド）。地面の切り替わりを示す実線 */
  edgeColor: '#a98a52',
  edgeOpacity: 0.7,
  /** 中央線（車道の白い破線）。アスファルトが見えている通路の上に描く */
  laneColor: '#ffffff',
  laneOpacity: 0.75,
  /** 俯瞰時に道全体へかぶせる色 */
  overviewTintColor: '#7ED957',
  overviewTintOpacity: 0.34,
} as const;

/**
 * 中央通路の半幅（メートル）。
 *
 * 通路の広さを決めているのは道幅ではなく屋台の位置なので、道の半幅に対する比率ではなく
 * 実寸で持つ。道幅を変えても通路が一緒に伸び縮みしてしまうのを避けるため。
 *
 * 実測（market_locations 300件）では、店舗の中心線からの横距離は
 * 最小 5.87m・中央値 7.50m。いちばん内側の屋台の手前で収まる値にしている。
 */
export const ROAD_CORRIDOR_HALF_WIDTH_METERS = 4.5;

/** 通路が道からはみ出さないようにした実効値 */
export function getRoadCorridorHalfWidthMeters(roadHalfWidthMeters: number): number {
  return Math.min(ROAD_CORRIDOR_HALF_WIDTH_METERS, roadHalfWidthMeters);
}

/**
 * 道の縁の線幅（px）。
 *
 * Leaflet の Polyline は線幅をピクセルで指定するため、固定値だと引いたときに
 * 道幅に対して相対的に太くなりすぎる。ズームに追従させつつ、段階を粗く量子化して
 * ズーム中の再描画回数を抑える（zoomSnap 0.05 の刻みごとに書き換えないため）。
 */
export function getRoadEdgeWeight(zoom: number): number {
  if (zoom >= 20) return 3;
  if (zoom >= 18.5) return 2.5;
  if (zoom >= 17) return 2;
  return 1.5;
}

/** getRoadEdgeWeight が段階を変えるズーム境界（MapLibre の式と共有する） */
export const ROAD_EDGE_WEIGHT_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1.5],
  [17, 2],
  [18.5, 2.5],
  [20, 3],
];

/** 中央線の線幅（px）。縁より細くして、縁と主張が競合しないようにする */
export function getRoadLaneWeight(zoom: number): number {
  if (zoom >= 20) return 2;
  if (zoom >= 18.5) return 1.5;
  return 1;
}

/** getRoadLaneWeight が段階を変えるズーム境界（MapLibre の式と共有する） */
export const ROAD_LANE_WEIGHT_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [18.5, 1.5],
  [20, 2],
];

/**
 * 中央線の破線の実寸（メートル）で [線, 空白]。
 *
 * 以前は線幅に対する倍率で持っていたが、線幅はズームで 1〜2px しか変わらないので
 * 破線の長さが画面上でほぼ一定になり、道が大きくなる拡大時ほど相対的に短く見えていた。
 * 実際の車線境界線は実寸で決まっているので、こちらも実寸で持ってズームに追従させる。
 */
export const ROAD_LANE_DASH_METERS: readonly [number, number] = [5, 2.5];

/** 引いたときに破線が潰れて点線に見えなくならないための下限（px） */
const ROAD_LANE_DASH_MIN_PX = 6;

/** 破線の長さを実寸で決めるときの基準緯度（追手筋の中心線） */
const ROAD_REFERENCE_LATITUDE = 33.5614118;

/** ズーム0・256px タイルでの m/px。Leaflet と MapLibre で同じ尺度になる */
const METERS_PER_PIXEL_AT_ZOOM_0 = 156543.03392;

/**
 * Leaflet のズームでの 1m あたりのピクセル数。
 * 中央線の破線のほか、ShopScanCards が店舗の間隔から札の大きさを決めるのにも使う。
 */
export function getPixelsPerMeter(zoom: number): number {
  const metersPerPixel =
    (METERS_PER_PIXEL_AT_ZOOM_0 * Math.cos((ROAD_REFERENCE_LATITUDE * Math.PI) / 180)) /
    Math.pow(2, zoom);
  return 1 / metersPerPixel;
}

/**
 * 中央線の破線を px で返す（Leaflet のズーム基準）。
 *
 * 実寸どおりだと引いたときに 1px を割って破線が消えるので、
 * 下限を割る場合だけ線と空白を同じ比率で引き伸ばす。
 */
export function getRoadLaneDashPx(zoom: number): [number, number] {
  const pixelsPerMeter = getPixelsPerMeter(zoom);
  const [dashMeters, gapMeters] = ROAD_LANE_DASH_METERS;
  const dashPx = dashMeters * pixelsPerMeter;
  const scale = Math.max(1, ROAD_LANE_DASH_MIN_PX / dashPx);
  return [dashPx * scale, gapMeters * pixelsPerMeter * scale];
}

/** Leaflet の dashArray（px 指定）に変換する */
export function getRoadLaneDashArray(zoom: number): string {
  return getRoadLaneDashPx(zoom)
    .map((px) => px.toFixed(1))
    .join(',');
}

/**
 * MapLibre の line-dasharray（線幅を単位に取る）に変換する。
 *
 * line-dasharray は interpolate に対応していないため、MapLibre 側は step で
 * 段階的に近似する。その段階の刻み。
 */
export const ROAD_LANE_DASH_ZOOM_STEP = 0.5;
export const ROAD_LANE_DASH_ZOOM_RANGE: readonly [number, number] = [15, 21];

export function getRoadLaneDashUnits(zoom: number): [number, number] {
  const weight = getRoadLaneWeight(zoom);
  const [dashPx, gapPx] = getRoadLaneDashPx(zoom);
  return [dashPx / weight, gapPx / weight];
}
