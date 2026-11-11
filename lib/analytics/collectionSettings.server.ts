import { createAdminClient } from "@/lib/supabase/adminClient";
import { parseAnalyticsCollectionSettings, type AnalyticsCollectionKey, type AnalyticsCollectionSettings } from "./collectionSettings";

export const ANALYTICS_SETTINGS_KEY = "analytics_collection";

/** 読み取りに失敗した場合は例外とし、呼び出し側で記録を停止する。 */
export async function readAnalyticsCollectionSettings(): Promise<AnalyticsCollectionSettings> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Analytics settings unavailable");
  const { data, error } = await admin.from("system_settings").select("value").eq("key", ANALYTICS_SETTINGS_KEY).maybeSingle();
  if (error) throw new Error("Analytics settings unavailable");
  return parseAnalyticsCollectionSettings(data?.value);
}

export async function isAnalyticsCollectionEnabled(key: AnalyticsCollectionKey): Promise<boolean> {
  try {
    return (await readAnalyticsCollectionSettings())[key];
  } catch {
    return false;
  }
}
