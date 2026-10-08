import { NextResponse } from "next/server";
import { z } from "zod";
import { displayNameOf, logVendorActivity } from "@/lib/vendor/activityLog";
import { INVITE_STATUS_MESSAGE, InviteTokenSchema, type InviteStatus } from "@/lib/vendor/shopInvites";
import { hashInviteToken } from "@/lib/vendor/shopInvites.server";
import { requireJoinRequest } from "@/lib/vendor/joinGuard.server";
import { ensureVendorRole } from "@/lib/vendor/ensureVendorRole.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ token: InviteTokenSchema });

const STATUS_CODE: Record<Exclude<InviteStatus, "ok">, number> = {
  invalid: 404,
  expired: 410,
  full: 409,
  already_member: 409,
};

/**
 * POST: 招待リンクで店舗に参加する。ログインしている人なら誰でも（出店者ロールは、参加した時点で付ける）。
 *
 * 人数・期限の確認と追加は DB の関数（accept_shop_invite）が 1 回の処理でやるので、
 * 同時に押されても人数を超えない。すでに同じ店舗に入っている人が押し直したときは、成功として扱う
 * （参加の途中でロールの付与に失敗しても、押し直せば完了する）。
 */
export async function POST(request: Request) {
  const guard = await requireJoinRequest(request, "vendor-invite-accept");
  if (!guard.ok) return guard.response;
  const { user, db } = guard;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: INVITE_STATUS_MESSAGE.invalid, code: "invalid" }, { status: 404 });

  const tokenHash = hashInviteToken(parsed.data.token);
  const { data, error } = await db.rpc("accept_shop_invite", { p_token_hash: tokenHash, p_user_id: user.id });
  if (error) {
    console.error("[vendor/invites/accept] rpc error:", error.message);
    return NextResponse.json({ error: "参加できませんでした" }, { status: 500 });
  }
  const result = (Array.isArray(data) ? data[0] : data) as
    | { status: InviteStatus; vendor_id: string | null }
    | undefined;
  if (!result) return NextResponse.json({ error: "参加できませんでした" }, { status: 500 });

  let vendorId = result.vendor_id;
  let joinedNow = result.status === "ok";

  if (result.status === "already_member") {
    // 同じ店舗の招待を押し直しただけなら成功にする。別の店舗に入っているなら断る
    const [{ data: invite }, { data: member }] = await Promise.all([
      db.from("shop_invites").select("vendor_id").eq("token_hash", tokenHash).maybeSingle(),
      db.from("shop_members").select("vendor_id").eq("user_id", user.id).maybeSingle(),
    ]);
    if (!invite || !member || invite.vendor_id !== member.vendor_id) {
      return NextResponse.json({ error: INVITE_STATUS_MESSAGE.already_member, code: "already_member" }, { status: 409 });
    }
    vendorId = member.vendor_id as string;
    joinedNow = false;
  } else if (result.status !== "ok") {
    return NextResponse.json(
      { error: INVITE_STATUS_MESSAGE[result.status], code: result.status },
      { status: STATUS_CODE[result.status] },
    );
  }

  // 出店者ロールを付ける（運営ロールは下げない）。失敗しても押し直せば完了する
  if (!(await ensureVendorRole(db, user, "vendor/invites/accept"))) {
    return NextResponse.json({ error: "参加の仕上げに失敗しました。もう一度リンクを開いてください" }, { status: 500 });
  }

  if (joinedNow && vendorId) {
    await logVendorActivity(db, {
      vendorId,
      actorId: user.id,
      actorName: displayNameOf(user),
      action: "member.join",
      targetType: "member",
      targetId: user.id,
      summary: `${displayNameOf(user)}さんが招待リンクで参加した`,
    });
  }

  return NextResponse.json({ ok: true, vendorId, joinedNow });
}
