import { createAdminClient } from "@/lib/supabase/adminClient";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 公開切替の判定を失敗時に古い表示へ戻さない（IDの取り違えを防ぐ）。 */
export async function readPublicScheduleRollout(): Promise<boolean> {
  const client = createAdminClient() as unknown as SupabaseClient | null;
  if (!client) throw new Error("公開予定の設定を確認できません");
  const { data, error } = await client.from("public_schedule_rollout").select("enabled").eq("id", true).single();
  if (error || typeof data?.enabled !== "boolean") throw new Error("公開予定の設定を確認できません");
  return data.enabled;
}
