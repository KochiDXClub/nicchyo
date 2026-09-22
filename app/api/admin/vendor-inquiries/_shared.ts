import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isModerator } from "@/lib/auth/permissions";

/**
 * vendor_inquiries / vendor_inquiry_replies を扱うサービスロールクライアント。
 * 「env未設定なら null（呼び出し側で503にする）」という同じ実装が他にも
 * あったため、共通の createAdminServiceClientOrNull に1本化した
 */
export { createAdminServiceClientOrNull as createAdminClient } from "@/lib/auth/requireAdminApi";

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
