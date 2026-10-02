import { NextResponse } from "next/server";
import { z } from "zod";
import { canGrantPermissions, canManageMember } from "@/lib/vendor/memberRules";
import { displayNameOf, logVendorActivity } from "@/lib/vendor/activityLog";
import { parseShopPermissions, SHOP_PERMISSION_META } from "@/lib/vendor/shopPermissions";
import { findMember, NOT_FOUND, requireMembersApi, toMemberRef } from "../shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ userId: string }> };

const PatchSchema = z.object({ permissions: z.array(z.string()).max(20) });

/**
 * PATCH: メンバーの権限を差し替える（メンバーの管理ができる人だけ）。
 * 規則は lib/vendor/memberRules.ts（副代表は members_manage の付け外しや、副代表どうしの変更ができない）。
 */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await requireMembersApi(request, { permission: "members_manage", write: true });
  if (!auth.ok) return auth.response;
  const { db, vendorId, membership, me, user } = auth;

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) return NOT_FOUND();

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null));
  const wanted = parsed.success ? parseShopPermissions(parsed.data.permissions) : null;
  if (!wanted) return NextResponse.json({ error: "権限を読み取れませんでした" }, { status: 400 });

  const row = await findMember(db, vendorId, userId);
  if (!row) return NOT_FOUND();
  const target = toMemberRef(row);

  if (!canManageMember(me, target)) {
    return NextResponse.json({ error: "このメンバーの権限は変えられません" }, { status: 403 });
  }
  // 付ける権限と外す権限の両方が、自分の付けられる範囲でなければならない
  // （members_manage を持たない副代表が、外す側で members_manage を動かせないように）
  const changed = [
    ...wanted.filter((p) => !target.permissions.includes(p)),
    ...target.permissions.filter((p) => !wanted.includes(p)),
  ];
  if (!canGrantPermissions(membership, changed)) {
    return NextResponse.json({ error: "自分が持っていない権限や、メンバー管理の権限は変えられません" }, { status: 403 });
  }

  const { error } = await db
    .from("shop_members")
    .update({ permissions: wanted, updated_at: new Date().toISOString() })
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .eq("role", "member");
  if (error) return NextResponse.json({ error: "保存できませんでした" }, { status: 500 });

  const { data: targetUser } = await db.auth.admin.getUserById(userId);
  const labels = changed.map((p) => SHOP_PERMISSION_META[p].label).join("・");
  await logVendorActivity(db, {
    vendorId,
    actorId: user.id,
    actorName: displayNameOf(user),
    action: "member.permissions",
    targetType: "member",
    targetId: userId,
    summary: `${targetUser?.user ? displayNameOf(targetUser.user) : "メンバー"}さんの権限を変えた（${labels || "変更なし"}）`,
    details: { before: target.permissions, after: wanted },
  });

  return NextResponse.json({ ok: true, permissions: wanted });
}

/**
 * DELETE: メンバーを店舗から外す（メンバーの管理ができる人だけ）。
 * 外した人のログインアカウントそのものは消さない（出店者ロールは残るが、店舗に入っていないので何もできない）。
 */
export async function DELETE(request: Request, { params }: Params) {
  const auth = await requireMembersApi(request, { permission: "members_manage", write: true });
  if (!auth.ok) return auth.response;
  const { db, vendorId, me, user } = auth;

  const { userId } = await params;
  if (!z.string().uuid().safeParse(userId).success) return NOT_FOUND();

  const row = await findMember(db, vendorId, userId);
  if (!row) return NOT_FOUND();
  if (!canManageMember(me, toMemberRef(row))) {
    return NextResponse.json({ error: "このメンバーは外せません" }, { status: 403 });
  }

  const { error } = await db
    .from("shop_members")
    .delete()
    .eq("vendor_id", vendorId)
    .eq("user_id", userId)
    .eq("role", "member");
  if (error) return NextResponse.json({ error: "外せませんでした" }, { status: 500 });

  const { data: targetUser } = await db.auth.admin.getUserById(userId);
  await logVendorActivity(db, {
    vendorId,
    actorId: user.id,
    actorName: displayNameOf(user),
    action: "member.remove",
    targetType: "member",
    targetId: userId,
    summary: `${targetUser?.user ? displayNameOf(targetUser.user) : "メンバー"}さんを店舗から外した`,
  });

  return NextResponse.json({ ok: true });
}
