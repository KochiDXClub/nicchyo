/**
 * スポット管理（/admin/spots と /api/admin/spots）で共有する定数と型。
 * API ルートはサーバー専用モジュール（next/headers）に依存するため、
 * クライアントの管理画面はここから import する。
 */

export const SPOT_CATEGORIES = ["transit", "landmark", "restroom", "rest"] as const;
export type SpotCategory = (typeof SPOT_CATEGORIES)[number];

export interface AdminSpot {
  key: string;
  name: string;
  description: string;
  image_url: string;
  latitude: number;
  longitude: number;
  width_px: number;
  height_px: number;
  show_at_min_zoom: boolean;
  category: SpotCategory;
  transit_mode: "tram" | "jr" | null;
  lines: string[];
  tags: string[];
  notes: string | null;
  external_url: string | null;
  photo_url: string | null;
  photo_credit: string | null;
  open_from: string | null;
  open_until: string | null;
  show_on_map: boolean;
  verified: boolean;
  updated_at: string;
}
