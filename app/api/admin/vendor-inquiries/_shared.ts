import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminServiceClient } from "@/lib/auth/requireAdminApi";
import { getRole, isModerator } from "@/lib/auth/permissions";
import type { DatabaseWithExtensions } from "@/types/database.extensions";

/**
 * vendor_inquiries / vendor_inquiry_replies を扱うサービスロールクライアント。
 *
 * 生成そのものは共通の createAdminServiceClient に任せる。あちらは環境変数が
 * 無いと throw するが、このAPI群は「設定漏れなら503を返す」挙動に揃えたいので、
 * ここで null に変換している。
 */
export function createAdminClient(): SupabaseClient<DatabaseWithExtensions> | null {
  try {
    return createAdminServiceClient();
  } catch {
    return null;
  }
}

/**
 * moderator 以上のロールを持つログイン済みユーザーだけを通す。
 *
 * 共通の requireAdminApi は admin のみを通すため、moderator も対象にする
 * この機能では使えない（#470 の運営＝admin/moderator）。
 */
export async function authorizeRequest(): Promise<
  { user: User; error: null } | { user: null; error: string }
> {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isModerator(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}
