import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { INVITE_STATUS_MESSAGE, InviteTokenSchema, type InviteStatus } from "@/lib/vendor/shopInvites";
import { hashInviteToken } from "@/lib/vendor/shopInvites.server";
import { parseShopPermissions } from "@/lib/vendor/shopPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ token: InviteTokenSchema });

/**
 * POST: 招待リンクの中身（どのお店か・付く権限・使えるか）を、ログイン前でも見せる。
 * 参加画面の「○○に参加しますか？」に使う。トークンを URL に載せず本文で受けるのは、アクセスログに残さないため。
 * リンクの総当たりを避けるため IP ごとに回数を絞り、「無い」「取り消し済み」は同じ答えにする。
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const limited = await enforceRateLimit(request, {
    bucket: "vendor-invite-preview",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (limited) return limited;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ status: "invalid", message: INVITE_STATUS_MESSAGE.invalid });

  const db = createAdminClient() as unknown as SupabaseClient | null;
  if (!db) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: invite } = await db
    .from("shop_invites")
    .select("vendor_id, permissions, max_uses, used_count, expires_at, revoked_at")
    .eq("token_hash", hashInviteToken(parsed.data.token))
    .maybeSingle();

  let status: InviteStatus = "ok";
  if (!invite || invite.revoked_at) status = "invalid";
  else if (Date.parse(invite.expires_at as string) <= Date.now()) status = "expired";
  else if ((invite.used_count as number) >= (invite.max_uses as number)) status = "full";

  if (status !== "ok" || !invite) {
    const message = INVITE_STATUS_MESSAGE[status === "ok" ? "invalid" : status];
    return NextResponse.json({ status, message });
  }

  const { data: vendor } = await db.from("vendors").select("shop_name").eq("id", invite.vendor_id).maybeSingle();
  return NextResponse.json({
    status: "ok",
    shopName: (vendor?.shop_name as string | undefined) ?? "お店",
    permissions: parseShopPermissions(invite.permissions) ?? [],
    expiresAt: invite.expires_at,
  });
}
