/**
 * 管理画面で保存したマップの表示範囲をサーバー側で読む。
 *
 * map_view_settings は公開読み取りなので、公開ページ用のキー
 * （publishable / anon）で読む。失敗したら既定値を返す
 * （設定が読めないことでマップが真っ白になるより、今までの範囲で動くほうがよい）。
 *
 * lib/mapFeatureFlags.server.ts と同じく、1リクエスト内では1回だけ問い合わせる。
 */

import { cache } from "react";
import { createAnonClient } from "@/lib/supabase/anonClient";
import {
  DEFAULT_MAP_VIEW_SETTINGS,
  mapViewSettingsFromRow,
  type MapViewSettings,
} from "./mapViewSettings";

export const MAP_VIEW_SETTINGS_KEY = "default";

export const fetchMapViewSettings = cache(async (): Promise<MapViewSettings> => {
  try {
    const client = createAnonClient();
    if (!client) return DEFAULT_MAP_VIEW_SETTINGS;
    const { data } = await client
      .from("map_view_settings")
      .select("mode, padding_meters, north, south, east, west, min_zoom")
      .eq("key", MAP_VIEW_SETTINGS_KEY)
      .maybeSingle();
    return mapViewSettingsFromRow(data);
  } catch {
    return DEFAULT_MAP_VIEW_SETTINGS;
  }
});
