import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { logVendorActivities } from "@/lib/vendor/activityLog";
import {
  AdminInviteActionSchema,
  inviteExpiresAt,
  toInviteView,
  type InviteViewRow,
} from "@/lib/vendor/shopInvites";
import { generateInviteToken, hashInviteToken } from "@/lib/vendor/shopInvites.server";
import { SHOP_PERMISSION_META, parseShopPermissions } from "@/lib/vendor/shopPermissions";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 店舗の操作ログに残す名前（個人名ではなく「運営」と出す。QR の発行と同じ） */
const OPERATOR_NAME = "運営";
/** 一覧に出す件数（店舗側の一覧と同じ） */
const LIST_LIMIT = 30;

/**
 * GET ?vendorId=…: その店舗の招待リンクの一覧（運営のみ）。
 * リンクの本体（トークン）は保存していないので、作った直後の応答以外では URL を出せない。
 */
export async function GET(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const db = auth.adminClient as unknown as SupabaseClient;

  const vendorId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("vendorId"));
  if (!vendorId.success) return NextResponse.json({ error: "店舗を確かめてください" }, { status: 400 });

  const { data, error } = await db
    .from("shop_invites")
    .select("id, permissions, max_uses, used_count, expires_at, created_at, revoked_at")
    .eq("vendor_id", vendorId.data)
    .order("created_at", { ascending: false })
    .limit(LIST_LIMIT);
  if (error) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });

  return NextResponse.json({ invites: (data ?? []).map((row) => toInviteView(row as InviteViewRow)) });
}

/**
 * POST: 運営が店舗の招待リンクを作る・取り消す。
 *   { action: "create", vendorId, maxUses, permissions } … 有効期限 7 日・1〜5 人。URL は、この応答でしか見せない
 *   { action: "revoke", vendorId, inviteId } … すでに入った人はそのまま
 * 招待で入った人は「メンバー」になる（代表者にはならない）。代表者がいない店舗に
 * メンバーだけが残らないよう、代表者がいる店舗にしか作らせない。代表者は QR で決める。
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { user, role, adminClient } = auth;
  const db = adminClient as unknown as SupabaseClient;
  const actor = { id: user.id, email: user.email, role };

  const parsed = AdminInviteActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "人数（1〜5人）と権限を確かめてください" }, { status: 400 });
  const input = parsed.data;

  const { data: shop } = await db.from("vendors").select("shop_name, role").eq("id", input.vendorId).maybeSingle();
  // 運営アカウントの行（vendors.role が admin など）は店舗ではない
  if (!shop || (shop.role ?? "vendor") !== "vendor") return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  const shopName = (shop.shop_name as string | null) ?? null;

  if (input.action === "revoke") {
    // 店舗をまたいで取り消せないよう、vendor_id でも絞る
    const { data, error } = await db
      .from("shop_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", input.inviteId)
      .eq("vendor_id", input.vendorId)
      .is("revoked_at", null)
      .select("id");
    if (error) return NextResponse.json({ error: "取り消せませんでした" }, { status: 500 });
    if (!data || data.length === 0) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    await Promise.all([
      logAdminAudit(adminClient, actor, {
        action: "shop_invite_revoke",
        targetType: "shop",
        targetId: input.vendorId,
        targetName: shopName,
        details: JSON.stringify({ inviteId: input.inviteId }),
      }),
      logVendorActivities(db, [
        {
          vendorId: input.vendorId,
          actorId: user.id,
          actorName: OPERATOR_NAME,
          action: "invite.revoke",
          targetType: "invite",
          targetId: input.inviteId,
          summary: "運営が招待リンクを取り消した",
        },
      ]),
    ]);
    return NextResponse.json({ ok: true });
  }

  const permissions = parseShopPermissions(input.permissions) ?? [];
  const { data: owner, error: ownerError } = await db
    .from("shop_members")
    .select("user_id")
    .eq("vendor_id", input.vendorId)
    .eq("role", "owner")
    .limit(1);
  if (ownerError) return NextResponse.json({ error: "リンクを作れませんでした" }, { status: 500 });
  if (!owner || owner.length === 0) {
    return NextResponse.json({ error: "代表者がいない店舗には招待リンクを作れません。先にQRコードで代表者を決めてください" }, { status: 409 });
  }

  const token = generateInviteToken();
  const expiresAt = inviteExpiresAt();
  const { data, error } = await db
    .from("shop_invites")
    .insert({
      vendor_id: input.vendorId,
      token_hash: hashInviteToken(token),
      permissions,
      max_uses: input.maxUses,
      expires_at: expiresAt.toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "リンクを作れませんでした" }, { status: 500 });

  const labels = permissions.map((p) => SHOP_PERMISSION_META[p].label).join("・");
  await Promise.all([
    logAdminAudit(adminClient, actor, {
      action: "shop_invite_create",
      targetType: "shop",
      targetId: input.vendorId,
      targetName: shopName,
      details: JSON.stringify({ inviteId: data.id, maxUses: input.maxUses, permissions }),
    }),
    logVendorActivities(db, [
      {
        vendorId: input.vendorId,
        actorId: user.id,
        actorName: OPERATOR_NAME,
        action: "invite.create",
        targetType: "invite",
        targetId: data.id as string,
        summary: `運営が招待リンクを作った（${input.maxUses}人まで・7日間・${labels || "権限なし"}）`,
        details: { maxUses: input.maxUses, permissions },
      },
    ]),
  ]);

  const url = `${new URL(request.url).origin}/join/${token}`;
  return NextResponse.json({ id: data.id, url, expiresAt: expiresAt.toISOString() }, { status: 201 });
}
