/**
 * マップの表示範囲（動かせる範囲）の設定
 *
 * 【なぜ設定にするか】
 * マップの可動範囲は「道の範囲＋余白」をコードに焼いた式で決めていた。
 * 余白が足りないと、引いたときに市場の外側が見えず窮屈に感じる。
 * どれくらい外側まで見せるかは運用の判断なので、コード変更・デプロイを
 * 待たずに管理画面（/admin/map-view）から動かせるようにする。
 *
 * 【決め方は2つ】
 * - auto:   道の範囲に余白（m）を足した長方形。道を編集すると追従する
 * - manual: 管理画面で四隅をドラッグして決めた長方形をそのまま使う
 *
 * 【効く範囲】
 * 適用先は MapLibre 版の描画（lib/mapFeatureFlags.ts の renderer=maplibre）。
 * Leaflet 版は従来どおり「道の範囲＋可視距離」の狭い枠のままにしてある。
 * 両方に効かせると、既定の描画（leaflet）の操作感まで黙って変わってしまうため。
 */

import { expandBoundsByMeters } from "@/app/(public)/map/utils/mapRouteGeometry";

/** 北・南・東・西の4辺で表した長方形 */
export type MapViewBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

/** 可動範囲の決め方 */
export type MapViewRangeMode = "auto" | "manual";

export interface MapViewSettings {
  mode: MapViewRangeMode;
  /** auto のときの余白（m）。道の範囲の外側にこれだけ足す */
  paddingMeters: number;
  /** manual のときの長方形。auto のときは null */
  bounds: MapViewBounds | null;
  /**
   * どこまで引けるか（Leaflet 基準のズーム値）。
   * MapLibre 版は 512px タイル基準なので、渡すときに 1 引く。
   */
  minZoom: number;
}

/**
 * 既定値。
 *
 * paddingMeters の 720 は、設定を入れる前に MapViewMapLibre が使っていた式
 * `max(visibleDistanceMeters + 48, 120) + 600` を既定値（可視距離 42m）で
 * 計算した値。既定のままなら今までと同じ範囲になる。
 * minZoom の 15 は config/roadConfig.ts の getRecommendedZoomBounds().min と同じ。
 */
export const DEFAULT_MAP_VIEW_SETTINGS: MapViewSettings = {
  mode: "auto",
  paddingMeters: 720,
  bounds: null,
  minZoom: 15,
};

/** 入力の許容範囲。DB の CHECK 制約（map_view_settings）と同じ値にする */
export const MAP_VIEW_LIMITS = {
  paddingMeters: { min: 0, max: 5000 },
  minZoom: { min: 10, max: 18 },
  /** 長方形の一辺の最小・最大（度）。潰れた枠や地球規模の枠を弾く */
  spanDeg: { min: 0.001, max: 0.5 },
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readNumber(value: unknown): number | null {
  const next = typeof value === "string" ? Number(value) : value;
  return typeof next === "number" && Number.isFinite(next) ? next : null;
}

/** 部分的な値や DB 由来の値を、既定値で埋めて正規化する */
export function normalizeMapViewSettings(
  value: unknown,
  base: MapViewSettings = DEFAULT_MAP_VIEW_SETTINGS
): MapViewSettings {
  if (!value || typeof value !== "object") return base;
  const record = value as Record<string, unknown>;

  const paddingMeters = readNumber(record.paddingMeters);
  const minZoom = readNumber(record.minZoom);
  const bounds = normalizeMapViewBounds(record.bounds);

  // 長方形が無い状態で manual にすると可動範囲が決まらないので auto に倒す
  const mode: MapViewRangeMode = record.mode === "manual" && bounds ? "manual" : "auto";

  return {
    mode,
    paddingMeters:
      paddingMeters === null
        ? base.paddingMeters
        : clamp(paddingMeters, MAP_VIEW_LIMITS.paddingMeters.min, MAP_VIEW_LIMITS.paddingMeters.max),
    bounds,
    minZoom:
      minZoom === null ? base.minZoom : clamp(minZoom, MAP_VIEW_LIMITS.minZoom.min, MAP_VIEW_LIMITS.minZoom.max),
  };
}

/**
 * 長方形を正規化する。
 * 4辺が揃っていない・南北や東西が逆・辺が短すぎる／長すぎるものは null にする
 * （null なら auto の計算に落ちるので、マップが操作できなくなることはない）。
 */
export function normalizeMapViewBounds(value: unknown): MapViewBounds | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;

  const north = readNumber(record.north);
  const south = readNumber(record.south);
  const east = readNumber(record.east);
  const west = readNumber(record.west);
  if (north === null || south === null || east === null || west === null) return null;

  if (Math.abs(north) > 90 || Math.abs(south) > 90) return null;
  if (Math.abs(east) > 180 || Math.abs(west) > 180) return null;

  const latSpan = north - south;
  const lngSpan = east - west;
  const { min, max } = MAP_VIEW_LIMITS.spanDeg;
  if (latSpan < min || lngSpan < min) return null;
  if (latSpan > max || lngSpan > max) return null;

  return { north, south, east, west };
}

/** [[lat, lng], [lat, lng]] の組を、辺の向きに依存しない長方形に直す */
export function toMapViewBounds(pair: [[number, number], [number, number]]): MapViewBounds {
  return {
    north: Math.max(pair[0][0], pair[1][0]),
    south: Math.min(pair[0][0], pair[1][0]),
    east: Math.max(pair[0][1], pair[1][1]),
    west: Math.min(pair[0][1], pair[1][1]),
  };
}

/** MapLibre の maxBounds が受け取る [[west, south], [east, north]] に直す */
export function toLngLatBoundsPair(bounds: MapViewBounds): [[number, number], [number, number]] {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ];
}

/** 設定と道の範囲から、実際に使う可動範囲を求める */
export function resolveMapViewBounds(
  settings: MapViewSettings,
  routeBounds: [[number, number], [number, number]]
): MapViewBounds {
  if (settings.mode === "manual" && settings.bounds) {
    return settings.bounds;
  }
  return toMapViewBounds(expandBoundsByMeters(routeBounds, settings.paddingMeters));
}

/** 長方形が道の範囲を丸ごと含んでいるか。含まないと市場の一部に近づけなくなる */
export function containsRouteBounds(
  bounds: MapViewBounds,
  routeBounds: [[number, number], [number, number]]
): boolean {
  const route = toMapViewBounds(routeBounds);
  return (
    bounds.north >= route.north &&
    bounds.south <= route.south &&
    bounds.east >= route.east &&
    bounds.west <= route.west
  );
}

/** map_view_settings の行を設定に直す。列が欠けていても既定値に落ちる */
export function mapViewSettingsFromRow(row: unknown): MapViewSettings {
  if (!row || typeof row !== "object") return DEFAULT_MAP_VIEW_SETTINGS;
  const record = row as Record<string, unknown>;
  return normalizeMapViewSettings({
    mode: record.mode,
    paddingMeters: record.padding_meters,
    minZoom: record.min_zoom,
    bounds: {
      north: record.north,
      south: record.south,
      east: record.east,
      west: record.west,
    },
  });
}

/**
 * 設定を map_view_settings の列に直す。
 *
 * auto に戻したときも長方形は残す。管理画面で四隅を合わせたあと auto を
 * 試して manual に戻す、という操作でその作業が消えないようにするため
 * （どちらを使うかは mode だけが決める）。
 */
export function mapViewSettingsToRow(settings: MapViewSettings) {
  return {
    mode: settings.mode,
    padding_meters: settings.paddingMeters,
    min_zoom: settings.minZoom,
    north: settings.bounds?.north ?? null,
    south: settings.bounds?.south ?? null,
    east: settings.bounds?.east ?? null,
    west: settings.bounds?.west ?? null,
  };
}
