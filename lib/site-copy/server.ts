import "server-only";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { DEFAULT_SITE_COPY, resolveSiteCopy, type SiteCopy } from "./content";

export const SITE_COPY_CACHE_TAG = "public-site-copy";

/**
 * 公開版は全ページの共通部品（ルートレイアウト）が読むため、毎回 Supabase を叩くと日曜市の混雑時に DB 負荷になる。
 * カテゴリと同じく Data Cache に置き、公開したときだけ revalidateSiteCopy でタグを捨てる（1時間は保険）。
 * 読めなかったときは例外にして、結果をキャッシュさせない（次の表示でやり直す）。
 */
const readPublishedSiteCopy = unstable_cache(
  async (): Promise<SiteCopy> => {
    const db = createAdminClient();
    if (!db) return DEFAULT_SITE_COPY;
    const { data, error } = await db.from("site_copy_state").select("published").eq("id", 1).maybeSingle();
    if (error) throw new Error("サイト文言の取得に失敗しました");
    return (data?.published ? resolveSiteCopy(data.published) : null) ?? DEFAULT_SITE_COPY;
  },
  ["public-site-copy-v1"],
  { tags: [SITE_COPY_CACHE_TAG], revalidate: 3600 },
);

/** 保存済みの公開版だけを使用。DB未設定や移行前、読めないときはコードの文言に戻す。 */
export const getPublishedSiteCopy = cache(async (): Promise<SiteCopy> => {
  try {
    return await readPublishedSiteCopy();
  } catch {
    return DEFAULT_SITE_COPY;
  }
});

/** 公開したときに呼ぶ。次の表示から新しい版が使われる */
export function revalidateSiteCopy() {
  revalidateTag(SITE_COPY_CACHE_TAG, { expire: 0 });
}
