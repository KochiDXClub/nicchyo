import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { DEFAULT_SITE_COPY, resolveSiteCopy } from "./content";

/** 保存済みの公開版だけを使用。DB未設定や移行前はコードの文言に戻す。 */
export const getPublishedSiteCopy = cache(async () => {
  try {
    const db = createAdminClient();
    if (!db) return DEFAULT_SITE_COPY;
    const { data, error } = await db.from("site_copy_state").select("published").eq("id", 1).maybeSingle();
    return !error && data?.published ? resolveSiteCopy(data.published) ?? DEFAULT_SITE_COPY : DEFAULT_SITE_COPY;
  } catch {
    return DEFAULT_SITE_COPY;
  }
});
