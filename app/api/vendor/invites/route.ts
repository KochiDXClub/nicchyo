import { NextResponse } from "next/server";
import { canGrantPermissions } from "@/lib/vendor/memberRules";
import { displayNameOf, logVendorActivity } from "@/lib/vendor/activityLog";
import { inviteExpiresAt, parseCreateInvite } from "@/lib/vendor/shopInvites";
import { generateInviteToken, hashInviteToken } from "@/lib/vendor/shopInvites.server";
import { parseShopPermissions, SHOP_PERMISSION_META } from "@/lib/vendor/shopPermissions";
import { requireMembersApi } from "../members/shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 一覧に出す件数。有効なリンクを優先して、古い取り消し済みのものは出し過ぎない */
const LIST_LIMIT = 30;

/**
 * GET: この店舗の招待リンクの一覧（メンバーの管理ができる人だけ）。
 * リンクの本体（トークン）は保存していないので、作った直後の画面以外では URL を出せない。
 */
export async function GET(request: Request) {
  const auth = await requireMembersApi(request, { permission: "members_manage" });
  if (!auth.ok) return auth.response;
  const { db, vendorId } = auth;

  const { data, error } = await db
    .from("shop_invites")
    .select("id, permissions, max_uses, used_count, expires_at, created_at, revoked_at, created_by")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  const now = Date.now();
  const invites = (data ?? []).map((row) => {
    const expired = Date.parse(row.expires_at as string) <= now;
    const revoked = row.revoked_at != null;
    const full = (row.used_count as number) >= (row.max_uses as number);
    return {
      id: row.id as string,
      permissions: parseShopPermissions(row.permissions) ?? [],
      maxUses: row.max_uses as number,
      usedCount: row.used_count as number,
      expiresAt: row.expires_at as string,
      createdAt: row.created_at as string,
      // 画面ではこの状態だけ見て、取り消しボタンの出し分けなどに使う
      state: revoked ? "revoked" : expired ? "expired" : full ? "full" : "active",
    };
  });

  return NextResponse.json({ invites });
}

/**
 * POST: 招待リンクを作る（メンバーの管理ができる人だけ）。
 * 有効期限は 7 日、人数は 1〜5 人。付ける権限は、作る人が付けてよい範囲だけ（lib/vendor/memberRules.ts）。
 * 返す url は、この 1 回だけ（サーバーにはハッシュしか残さない）。
 */
export async function POST(request: Request) {
  const auth = await requireMembersApi(request, {
    permission: "members_manage",
    write: true,
    bucket: "vendor-invites-create",
  });
  if (!auth.ok) return auth.response;
  const { db, vendorId, membership, user } = auth;

  const input = parseCreateInvite(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "人数（1〜5人）と権限を確かめてください" }, { status: 400 });
  if (!canGrantPermissions(membership, input.permissions)) {
    return NextResponse.json({ error: "自分が持っていない権限や、メンバー管理の権限は付けられません" }, { status: 403 });
  }

  const token = generateInviteToken();
  const expiresAt = inviteExpiresAt();
  const { data, error } = await db
    .from("shop_invites")
    .insert({
      vendor_id: vendorId,
      token_hash: hashInviteToken(token),
      permissions: input.permissions,
      max_uses: input.maxUses,
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "リンクを作れませんでした" }, { status: 500 });

  const labels = input.permissions.map((p) => SHOP_PERMISSION_META[p].label).join("・");
  await logVendorActivity(db, {
    vendorId,
    actorId: user.id,
    actorName: displayNameOf(user),
    action: "invite.create",
    targetType: "invite",
    targetId: data.id as string,
    summary: `招待リンクを作った（${input.maxUses}人まで・7日間・${labels || "権限なし"}）`,
    details: { maxUses: input.maxUses, permissions: input.permissions },
  });

  const url = `${new URL(request.url).origin}/join/${token}`;
  return NextResponse.json({ id: data.id, url, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
