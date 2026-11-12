import { revalidateTag, unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/adminClient";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 公開切替の設定のキャッシュ。管理画面で切り替えたときに無効化する。 */
export const PUBLIC_SCHEDULE_ROLLOUT_CACHE_TAG = "public-schedule-rollout";

async function readRolloutUncached(): Promise<boolean> {
  // このテーブルは匿名から参照できない。サービスキーが無いときに匿名のエラーを
  // 「未移行」と解釈すると、公開済みの環境で古い番号に戻すおそれがある。
  const client = createAdminClient() as unknown as SupabaseClient | null;
  if (!client) throw new Error("公開予定の設定を確認できません");
  const { data, error } = await client.from("public_schedule_rollout").select("enabled").eq("id", true).single();
  if (error?.code === "PGRST205" || error?.code === "42P01") return false;
  if (error || typeof data?.enabled !== "boolean") throw new Error("公開予定の設定を確認できません");
  return data.enabled;
}

// 失敗（例外）はキャッシュされないので、次の読み取りで取り直す。
// 有効期間は短くし、別のサーバーに無効化が届くまでの食い違いを数十秒に抑える。
const readRolloutCached = unstable_cache(readRolloutUncached, [PUBLIC_SCHEDULE_ROLLOUT_CACHE_TAG], {
  tags: [PUBLIC_SCHEDULE_ROLLOUT_CACHE_TAG],
  revalidate: 30,
});

/** 公開切替の判定を失敗時に古い表示へ戻さない（IDの取り違えを防ぐ）。 */
export async function readPublicScheduleRollout(): Promise<boolean> {
  return readRolloutCached();
}

/** 公開設定を書き換えたあとに呼ぶ。このサーバーのキャッシュを捨てる。 */
export function revalidatePublicScheduleRollout(): void {
  revalidateTag(PUBLIC_SCHEDULE_ROLLOUT_CACHE_TAG, { expire: 0 });
}
