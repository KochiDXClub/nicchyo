import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { requireVendorContext } from "@/lib/vendor/shopContext.server";

/**
 * お知らせ API の入口。同じオリジンからか、店舗のメンバー（運営・市役所との連絡の権限あり）かを確かめ、
 * service_role のクライアントを渡す（vendor_notices / vendor_notice_reads は service_role でしか読めず、
 * 生成済み Database 型にも未登録）。店舗の範囲に絞るのは呼び出し側（vendor_id = vendorId）。
 * 「確認しました」は店舗単位で、メンバーの誰かが押せば店舗全体で確認済みになる。
 */
export async function requireVendorNotices(
  request: Request
): Promise<
  | { ok: true; user: User; vendorId: string; db: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return { ok: false, response: originCheck.response };

  const auth = await requireVendorContext({ permission: "inquiries" });
  if (!auth.ok) return auth;

  const db = createAdminClient() as unknown as SupabaseClient | null;
  if (!db) return { ok: false, response: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };
  return { ok: true, user: auth.user, vendorId: auth.vendorId, db };
}
