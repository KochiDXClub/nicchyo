import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export type JoinGuardResult =
  | { ok: true; user: User; db: SupabaseClient }
  | { ok: false; response: NextResponse };

/**
 * 店舗に参加する API（招待リンク・QR コード）の入口。
 * 同じオリジンからか → ログインしているか → 回数（アカウントごと）→ service_role のクライアント、の順に確かめる。
 * まだ店舗に入っていない人が呼ぶので、requireVendorContext（所属店舗が要る）は使えない。
 */
export async function requireJoinRequest(request: Request, bucket: string): Promise<JoinGuardResult> {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return { ok: false, response: originCheck.response };

  const cookieStore = await cookies();
  const {
    data: { user },
  } = await createServerClient(cookieStore).auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const limited = await enforceRateLimit(request, {
    bucket,
    limit: 10,
    windowMs: 10 * 60 * 1000,
    identity: user.id,
  });
  if (limited) return { ok: false, response: limited };

  const db = createAdminClient() as unknown as SupabaseClient | null;
  if (!db) return { ok: false, response: NextResponse.json({ error: "Service unavailable" }, { status: 503 }) };

  return { ok: true, user, db };
}
