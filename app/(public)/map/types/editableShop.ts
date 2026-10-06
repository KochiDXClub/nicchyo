import type { RoadSide } from "../utils/roadSlotPosition";

/**
 * マップ編集画面（/admin/map-edit）で扱う区画の編集用データ型。
 * サーバー側（app/api/admin/map-layout/_shared.ts）とクライアント側
 * （app/(public)/map-edit/v3/types.ts）の両方から参照する共通定義。
 */
export type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
  chome?: string;
  /**
   * 道基準の位置（market_locations.road_*）。4つとも入っているか、どれも無いかのどちらか。
   * 入っている区画の lat/lng は道の形から計算した値で、道の形を直すとついてくる。
   * 無い区画（移行前の区画）は lat/lng がそのまま位置になる。
   */
  roadId?: string;
  roadDistanceM?: number;
  roadSide?: RoadSide;
  roadOffsetM?: number;
};

/**
 * 丁目の表示順・許容値の一覧。サーバー側（_shared.ts の normalizeChome）と
 * クライアント側（v3/types.ts, RoadLaneView.tsx）の両方が同じ並び・値を
 * 参照できるよう、ここに1本化する（別々に持つと丁目の増減時に片方だけ
 * 更新し忘れ、区画情報が黙って落ちる恐れがあるため）。
 */
export const CHOME_ORDER = ["一丁目", "二丁目", "三丁目", "四丁目", "五丁目", "六丁目", "七丁目"] as const;
