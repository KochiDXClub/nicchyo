import { NextResponse } from "next/server";
import { displayNameOf } from "@/lib/vendor/activityLog";
import { hasShopPermission } from "@/lib/vendor/shopPermissions";
import { requireMembersApi, toMemberRef, type MemberRow } from "./shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: 自分の店舗のメンバー一覧（代表者を含む）。メンバーなら誰でも見られる。
 * メールアドレスは、メンバーの管理ができる人（代表者・members_manage）にだけ返す。
 */
export async function GET(request: Request) {
  const auth = await requireMembersApi(request);
  if (!auth.ok) return auth.response;
  const { db, vendorId, membership, user } = auth;

  const { data, error } = await db
    .from("shop_members")
    .select("user_id, role, permissions, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  const canSeeEmail = hasShopPermission(membership, "members_manage");
  const rows = (data ?? []) as MemberRow[];
  const members = await Promise.all(
    rows.map(async (row) => {
      const ref = toMemberRef(row);
      const { data: authUser } = await db.auth.admin.getUserById(row.user_id);
      const target = authUser?.user;
      return {
        userId: ref.userId,
        name: target ? displayNameOf(target) : "名前未設定",
        email: canSeeEmail ? (target?.email ?? null) : null,
        role: ref.role,
        permissions: ref.permissions,
        joinedAt: row.created_at,
        isMe: ref.userId === user.id,
      };
    }),
  );
  // 代表者を先頭に、あとは参加順
  members.sort((a, b) => Number(b.role === "owner") - Number(a.role === "owner"));

  return NextResponse.json({ members, me: { role: membership.role, permissions: membership.permissions } });
}
