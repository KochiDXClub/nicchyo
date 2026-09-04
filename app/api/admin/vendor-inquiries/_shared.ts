import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isModerator } from "@/lib/auth/permissions";
import type { DatabaseWithExtensions } from "@/types/database.extensions";

/**
 * vendor_inquiries / vendor_inquiry_replies を扱うサービスロールクライアント。
 *
 * 共通の lib/supabase/adminClient.ts は型引数を取らず DatabaseWithExtensions を
 * 渡せないため、ここで別途生成している（共通側のジェネリック化は #530）。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient<DatabaseWithExtensions>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** moderator 以上のロールを持つログイン済みユーザーだけを通す */
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
