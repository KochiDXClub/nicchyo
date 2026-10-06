import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getRole } from "@/lib/auth/permissions";

/**
 * 店舗に入った（招待リンク・QR）アカウントへ、出店者ロール（app_metadata.role = 'vendor'）を付ける。
 * 運営ロール（admin / moderator）は下げない。すでに出店者ならなにもしない。
 *
 * ロールは app_metadata（本人が書き換えられない側）にだけ持つ。ログイン中のトークンには、
 * 画面側でセッションを更新するまで反映されない。
 * 戻り値: 失敗したとき（付与できなかったとき）は false。呼び出し側は押し直しで完了するようにしておくこと。
 */
export async function ensureVendorRole(db: SupabaseClient, user: User, logTag: string): Promise<boolean> {
  const role = getRole(user);
  if (role === "vendor" || role === "admin" || role === "moderator") return true;

  // app_metadata は項目ごとに混ぜて保存される。role だけを渡し、古い値で他の項目を上書きしない
  const { error } = await db.auth.admin.updateUserById(user.id, { app_metadata: { role: "vendor" } });
  if (error) {
    console.error(`[${logTag}] role update error:`, error.message);
    return false;
  }
  return true;
}
