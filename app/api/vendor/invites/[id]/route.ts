import { NextResponse } from "next/server";
import { z } from "zod";
import { displayNameOf, logVendorActivity } from "@/lib/vendor/activityLog";
import { NOT_FOUND, requireMembersApi } from "../../members/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE: 招待リンクを取り消す（メンバーの管理ができる人だけ）。すでに入った人はそのまま。
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMembersApi(request, { permission: "members_manage", write: true });
  if (!auth.ok) return auth.response;
  const { db, vendorId, user } = auth;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NOT_FOUND();

  // 店舗をまたいで取り消せないよう、vendor_id でも絞る
  const { data, error } = await db
    .from("shop_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("vendor_id", vendorId)
    .is("revoked_at", null)
    .select("id");
  if (error) return NextResponse.json({ error: "取り消せませんでした" }, { status: 500 });
  if (!data || data.length === 0) return NOT_FOUND();

  await logVendorActivity(db, {
    vendorId,
    actorId: user.id,
    actorName: displayNameOf(user),
    action: "invite.revoke",
    targetType: "invite",
    targetId: id,
    summary: "招待リンクを取り消した",
  });

  return NextResponse.json({ ok: true });
}
