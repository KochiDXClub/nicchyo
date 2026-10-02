import { NextResponse } from "next/server";
import { z } from "zod";
import { canTransferOwnership } from "@/lib/vendor/memberRules";
import { displayNameOf, logVendorActivity } from "@/lib/vendor/activityLog";
import { findMember, requireMembersApi, toMemberRef } from "../../members/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({ toUserId: z.string().uuid() });

/**
 * POST: 代表者を、同じ店舗のメンバーに引き継ぐ（今の代表者だけ）。
 * 今の代表者は、全権限の「副代表」として店舗に残る。取り消しはできない（新しい代表者が引き継ぎ直す）。
 */
export async function POST(request: Request) {
  const auth = await requireMembersApi(request, { write: true, bucket: "vendor-owner-transfer" });
  if (!auth.ok) return auth.response;
  const { db, vendorId, me, user } = auth;

  if (me.role !== "owner") {
    return NextResponse.json({ error: "代表者だけが引き継げます" }, { status: 403 });
  }
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "引き継ぎ先を選んでください" }, { status: 400 });

  const row = await findMember(db, vendorId, parsed.data.toUserId);
  if (!row || !canTransferOwnership(me, toMemberRef(row))) {
    return NextResponse.json({ error: "この人には引き継げません" }, { status: 400 });
  }

  const { data: status, error } = await db.rpc("transfer_shop_ownership", {
    p_vendor_id: vendorId,
    p_from_user: user.id,
    p_to_user: parsed.data.toUserId,
  });
  if (error) {
    console.error("[vendor/owner/transfer] rpc error:", error.message);
    return NextResponse.json({ error: "引き継げませんでした" }, { status: 500 });
  }
  if (status !== "ok") return NextResponse.json({ error: "引き継げませんでした", code: status }, { status: 409 });

  const { data: next } = await db.auth.admin.getUserById(parsed.data.toUserId);
  await logVendorActivity(db, {
    vendorId,
    actorId: user.id,
    actorName: displayNameOf(user),
    action: "owner.transfer",
    targetType: "member",
    targetId: parsed.data.toUserId,
    summary: `代表者を${next?.user ? displayNameOf(next.user) : "メンバー"}さんに引き継いだ`,
  });

  return NextResponse.json({ ok: true });
}
