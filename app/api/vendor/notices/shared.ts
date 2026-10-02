import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireVendorRole } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";

/**
 * お知らせ API の入口。同じオリジンからか、ログインした出店者かを確かめ、
 * service_role のクライアントを渡す（vendor_notices / vendor_notice_reads は service_role でしか読めず、
 * 生成済み Database 型にも未登録）。出店者の範囲に絞るのは呼び出し側（vendor_id = user.id）。
 */
export async function requireVendorNotices(
  request: Request
): Promise<{ ok: true; user: User; db: SupabaseClient } | { ok: false; response: NextResponse }> {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return { ok: false, response: originCheck.response };

  const cookieStore = await cookies();
  const {
    data: { user },
  } = await createServerClient(cookieStore).auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const forbidden = requireVendorRole(user);
  if (forbidden) return { ok: false, response: forbidden };

  const db = createAdminClient() as unknown as SupabaseClient | null;
  if (!db) return { ok: false, response: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };
  return { ok: true, user, db };
}
