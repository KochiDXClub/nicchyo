import { revalidateTag, unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { parseAnalyticsCollectionSettings, type AnalyticsCollectionKey, type AnalyticsCollectionSettings } from "./collectionSettings";

export const ANALYTICS_SETTINGS_KEY = "analytics_collection";

export const ANALYTICS_SETTINGS_CACHE_TAG = "analytics-collection-settings";

/** 記録 API ごとに DB を読まないよう、短い時間キャッシュする。読み取り失敗は例外のままでキャッシュされない。 */
const readRawCached = unstable_cache(
  async (): Promise<unknown> => {
    const admin = createAdminClient();
    if (!admin) throw new Error("Analytics settings unavailable");
    const { data, error } = await admin.from("system_settings").select("value").eq("key", ANALYTICS_SETTINGS_KEY).maybeSingle();
    if (error) throw new Error("Analytics settings unavailable");
    return data?.value ?? null;
  },
  [ANALYTICS_SETTINGS_CACHE_TAG],
  { tags: [ANALYTICS_SETTINGS_CACHE_TAG], revalidate: 60 },
);

/** 読み取りに失敗した場合は例外とし、呼び出し側で記録を停止する。 */
export async function readAnalyticsCollectionSettings(): Promise<AnalyticsCollectionSettings> {
  return parseAnalyticsCollectionSettings(await readRawCached());
}

/** 設定を保存したあとに呼ぶ。次の読み取りから新しい値を使う。 */
export function revalidateAnalyticsCollectionSettings() {
  revalidateTag(ANALYTICS_SETTINGS_CACHE_TAG, { expire: 0 });
}

export async function isAnalyticsCollectionEnabled(key: AnalyticsCollectionKey): Promise<boolean> {
  try {
    return (await readAnalyticsCollectionSettings())[key];
  } catch {
    return false;
  }
}
