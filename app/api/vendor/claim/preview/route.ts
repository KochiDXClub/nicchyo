import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { CLAIM_STATUS_MESSAGE, ClaimTokenSchema } from "@/lib/vendor/shopClaim";
import { hashInviteToken } from "@/lib/vendor/shopInvites.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ token: ClaimTokenSchema });

/**
 * POST: QR コードの URL の中身（どのお店か・まだ使えるか）を、ログイン前でも見せる。
 * 紐づけ画面の「○○として登録しますか？」に使う。トークンは URL ではなく本文で受け、アクセスログに残さない。
 * 総当たりを避けるため IP ごとに回数を絞り、「無い」「取り消し済み」「使用済み」は同じ答えにする。
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const limited = await enforceRateLimit(request, {
    bucket: "vendor-claim-preview",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ status: "invalid", message: CLAIM_STATUS_MESSAGE.invalid });

  const db = createAdminClient() as unknown as SupabaseClient | null;
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: token } = await db
    .from("shop_claim_tokens")
    .select("vendor_id, revoked_at, claimed_at")
    .eq("token_hash", hashInviteToken(parsed.data.token))
    .maybeSingle();
  if (!token || token.revoked_at || token.claimed_at) {
    return NextResponse.json({ status: "invalid", message: CLAIM_STATUS_MESSAGE.invalid });
  }

  const { data: vendor } = await db.from("vendors").select("shop_name").eq("id", token.vendor_id).maybeSingle();
  return NextResponse.json({ status: "ok", shopName: (vendor?.shop_name as string | undefined) ?? "お店" });
}
