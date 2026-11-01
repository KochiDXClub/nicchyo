import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createAnonClient } from "@/lib/supabase/anonClient";
import { getRole } from "@/lib/auth/permissions";
import { isLinkVisible, ODEKAKE_VISIBILITY_PATH, parsePageVisibilitySettings, toVisibilityRole } from "@/lib/pageVisibility";

/** リンクの入口も地図と同じロール・公開設定で判断する。取得失敗時は入口を出さない。 */
export async function canShowOutingSupport(): Promise<boolean> {
  try {
    const client = createAnonClient();
    if (!client) return false;
    const { data, error } = await client.from("system_settings").select("value").eq("key", "page_visibility").maybeSingle();
    if (error) return false;
    let role = toVisibilityRole(null, false);
    try {
      const auth = createClient(await cookies());
      const { data: { user } } = await auth.auth.getUser();
      role = toVisibilityRole(getRole(user), !!user);
    } catch { /* セッションを確認できなければ未ログインの権限で判定 */ }
    return isLinkVisible(ODEKAKE_VISIBILITY_PATH, role, parsePageVisibilitySettings(data?.value));
  } catch { return false; }
}
