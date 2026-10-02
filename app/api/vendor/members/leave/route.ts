import { NextResponse } from "next/server";
import { canLeaveShop } from "@/lib/vendor/memberRules";
import { displayNameOf, logVendorActivity } from "@/lib/vendor/activityLog";
import { requireMembersApi } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST: 自分が店舗を抜ける。代表者は先に別のメンバーへ引き継ぐ必要がある（409）。
 */
export async function POST(request: Request) {
  const auth = await requireMembersApi(request, { write: true, bucket: "vendor-members-leave" });
  if (!auth.ok) return auth.response;
  const { db, vendorId, me, user } = auth;

  if (!canLeaveShop(me)) {
    return NextResponse.json(
      { error: "代表者は、先に別のメンバーへ代表者を引き継いでから抜けてください" },
      { status: 409 },
    );
  }

  const { error } = await db
    .from("shop_members")
    .delete()
    .eq("vendor_id", vendorId)
    .eq("user_id", user.id)
    .eq("role", "member");
  if (error) return NextResponse.json({ error: "店舗を抜けられませんでした" }, { status: 500 });

  await logVendorActivity(db, {
    vendorId,
    actorId: user.id,
    actorName: displayNameOf(user),
    action: "member.leave",
    targetType: "member",
    targetId: user.id,
    summary: `${displayNameOf(user)}さんが店舗を抜けた`,
  });

  return NextResponse.json({ ok: true });
}
