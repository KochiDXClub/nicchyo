/**
 * 管理画面で保存したマップ動作フラグをサーバー側で読む。
 * system_settings は管理者のみ読める RLS なので、公開ページでは service role で読む
 * （app/api/maintenance-status と同じ方式）。失敗したら既定値を返す。
 */

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/adminClient";
import {
  DEFAULT_MAP_FEATURE_FLAGS,
  normalizeMapFeatureFlags,
  type MapFeatureFlags,
} from "./mapFeatureFlags";

export const MAP_FLAGS_SETTINGS_KEY = "map_flags";

// layout と page の両方から呼ぶので、1 リクエスト内では 1 回だけ問い合わせる
export const fetchMapFeatureFlags = cache(async (): Promise<MapFeatureFlags> => {
  try {
    const client = createAdminClient();
    if (!client) return DEFAULT_MAP_FEATURE_FLAGS;
    const { data } = await client
      .from("system_settings")
      .select("value")
      .eq("key", MAP_FLAGS_SETTINGS_KEY)
      .maybeSingle();
    return normalizeMapFeatureFlags(data?.value);
  } catch {
    return DEFAULT_MAP_FEATURE_FLAGS;
  }
});
