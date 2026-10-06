import { NextResponse } from "next/server";
import { z } from "zod";
import { displayNameOf, logVendorActivity } from "@/lib/vendor/activityLog";
import { requireJoinRequest } from "@/lib/vendor/joinGuard.server";
import { ensureVendorRole } from "@/lib/vendor/ensureVendorRole.server";
import { CLAIM_STATUS_MESSAGE, ClaimTokenSchema, type ClaimStatus } from "@/lib/vendor/shopClaim";
import { hashInviteToken } from "@/lib/vendor/shopInvites.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ token: ClaimTokenSchema });

const STATUS_CODE: Record<Exclude<ClaimStatus, "ok">, number> = {
  invalid: 404,
  already_claimed: 409,
  already_member: 409,
};

/**
 * POST: 運営から配られた QR コードの URL で、ログイン中のアカウントを店舗の代表者として紐づける。
 * ログインしている人なら誰でも（出店者ロールは、紐づけた時点で付ける）。
 *
 * 確認と追加は DB の関数（claim_shop_with_token）が 1 回の処理でやるので、同時に読まれても代表者は 1 人。
 */
export async function POST(request: Request) {
  const guard = await requireJoinRequest(request, "vendor-claim");
  if (!guard.ok) return guard.response;
  const { user, db } = guard;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: CLAIM_STATUS_MESSAGE.invalid, code: "invalid" }, { status: 404 });

  const { data, error } = await db.rpc("claim_shop_with_token", {
    p_token_hash: hashInviteToken(parsed.data.token),
    p_user_id: user.id,
  });
  if (error) {
    console.error("[vendor/claim] rpc error:", error.message);
    return NextResponse.json({ error: "紐づけできませんでした" }, { status: 500 });
  }
  const result = (Array.isArray(data) ? data[0] : data) as { status: ClaimStatus; vendor_id: string | null } | undefined;
  if (!result) return NextResponse.json({ error: "紐づけできませんでした" }, { status: 500 });

  if (result.status !== "ok") {
    return NextResponse.json(
      { error: CLAIM_STATUS_MESSAGE[result.status], code: result.status },
      { status: STATUS_CODE[result.status] },
    );
  }

  // 紐づけは済んでいるので、ロールの付与に失敗したら、画面でもう一度開いてもらう。
  // QR は使用済みになっており、同じ人が開き直すと「すでに参加しています」になるため、ここで必ず付ける
  if (!(await ensureVendorRole(db, user, "vendor/claim"))) {
    return NextResponse.json(
      { error: "紐づけは完了しましたが、仕上げに失敗しました。ログインし直してください", code: "role_failed", vendorId: result.vendor_id },
      { status: 500 },
    );
  }

  if (result.vendor_id) {
    await logVendorActivity(db, {
      vendorId: result.vendor_id,
      actorId: user.id,
      actorName: displayNameOf(user),
      action: "qr.link",
      targetType: "member",
      targetId: user.id,
      summary: `${displayNameOf(user)}さんがQRコードで代表者として紐づいた`,
    });
  }

  return NextResponse.json({ ok: true, vendorId: result.vendor_id });
}
