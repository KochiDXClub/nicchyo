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

// false はキャッシュしない。期限切れの値を再検証中や失敗時に返す Next.js の
// 挙動により、別経路で公開された後も旧番号を返し続けることを防ぐ。
class RolloutNotEnabled extends Error {}
const readEnabledRolloutCached = unstable_cache(async () => {
  if (!(await readRolloutUncached())) throw new RolloutNotEnabled();
  return true;
}, ["public-schedule-rollout-enabled-v2"], {
  tags: [PUBLIC_SCHEDULE_ROLLOUT_CACHE_TAG],
  revalidate: 30,
});

/** 公開切替の判定を失敗時に古い表示へ戻さない（IDの取り違えを防ぐ）。 */
export async function readPublicScheduleRollout(): Promise<boolean> {
  try {
    return await readEnabledRolloutCached();
  } catch (error) {
    if (error instanceof RolloutNotEnabled) return false;
    throw error;
  }
}

/** 公開設定を書き換えたあとに呼ぶ。このサーバーのキャッシュを捨てる。 */
export function revalidatePublicScheduleRollout(): void {
  revalidateTag(PUBLIC_SCHEDULE_ROLLOUT_CACHE_TAG, { expire: 0 });
}
