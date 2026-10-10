/**
 * 地図のカメラ操作の共通インターフェース
 *
 * ページ側の部品（「このへん、なにがある？」の出現判定、ズームスライダー、施設案内の
 * flyTo など）は、地図ライブラリに直接依存せずこのインターフェースだけを使う。
 * MapViewMapLibre がアダプタを作る。ズーム値は Leaflet 時代の基準に換算する
 * （MapLibre は 512px タイル基準で 1 小さいので、アダプタ内で足し引きする）
 */

import type { Map as MapLibreMap } from "maplibre-gl";

export type MapCameraEvent = "move" | "zoom" | "movestart" | "zoomstart" | "moveend" | "zoomend";

export interface MapCamera {
  getContainer(): HTMLElement;
  getCenter(): { lat: number; lng: number };
  /** Leaflet 換算のズーム値 */
  getZoom(): number;
  getMaxZoom(): number;
  setZoom(zoom: number, options?: { animate?: boolean }): unknown;
  /** 中心とズームを直接指定して移動する（Leaflet の setView 相当） */
  setView(
    center: [number, number],
    zoom?: number,
    options?: { animate?: boolean; duration?: number }
  ): unknown;
  flyTo(
    latlng: [number, number],
    zoom?: number,
    /** easeLinearity は Leaflet 固有。MapLibre 版のアダプタでは無視する */
    options?: { animate?: boolean; duration?: number; easeLinearity?: number }
  ): unknown;
  /** 緯度経度 → 地図コンテナ内のピクセル座標 */
  latLngToContainerPoint(latlng: [number, number]): { x: number; y: number };
  /** 地図コンテナ内のピクセル座標 → 緯度経度 */
  containerPointToLatLng(point: [number, number] | { x: number; y: number }): { lat: number; lng: number };
  /** 2 点間の距離（メートル） */
  distance(a: { lat: number; lng: number } | [number, number], b: { lat: number; lng: number } | [number, number]): number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: MapCameraEvent, handler: (...args: any[]) => void): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: MapCameraEvent, handler: (...args: any[]) => void): unknown;
}

/** MapLibre 版のアダプタが、生の maplibregl.Map を持ち回るためのキー */
export const MAPLIBRE_MAP_KEY = "__nicchyoMapLibreMap";

/** MapLibre 版なら生の maplibregl.Map を返す（MapLibre 専用のレイヤーを載せるときに使う） */
export function getMapLibreMap(camera: MapCamera | null | undefined): MapLibreMap | null {
  if (!camera) return null;
  const raw = (camera as unknown as Record<string, unknown>)[MAPLIBRE_MAP_KEY];
  return (raw as MapLibreMap | undefined) ?? null;
}
