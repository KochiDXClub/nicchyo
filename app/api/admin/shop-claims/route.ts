import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdminApi } from "@/lib/auth/requireAdminApi";
import { logAdminAudit } from "@/lib/audit/logAdminAudit";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { logVendorActivities } from "@/lib/vendor/activityLog";
import { ClaimActionSchema, type ShopClaimState } from "@/lib/vendor/shopClaim";
import { generateInviteToken, hashInviteToken } from "@/lib/vendor/shopInvites.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 一度に並べて DB に問い合わせる件数（300 店を順番に待たず、かつ接続を使い切らない） */
const ISSUE_CONCURRENCY = 10;

/** 運営の操作ログに残す名前（個人名ではなく、店舗の操作ログに「運営」と出す） */
const OPERATOR_NAME = "運営";

/**
 * GET: 店舗ごとの紐づけの状態（代表者あり / QR発行済み・未紐づけ / 未発行）。管理画面の一覧用。
 */
export async function GET(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  // shop_members / shop_claim_tokens は生成済み Database 型に未登録のため型は付けない
  const db = auth.adminClient as unknown as SupabaseClient;

  const [vendors, members, tokens] = await Promise.all([
    db.from("vendors").select("id, shop_name, role").order("shop_name", { ascending: true }),
    db.from("shop_members").select("vendor_id, role"),
    db.from("shop_claim_tokens").select("vendor_id").is("revoked_at", null).is("claimed_at", null),
  ]);
  if (vendors.error || members.error || tokens.error) {
    return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  }

  const owners = new Set<string>();
  const memberCounts = new Map<string, number>();
  for (const row of members.data ?? []) {
    memberCounts.set(row.vendor_id as string, (memberCounts.get(row.vendor_id as string) ?? 0) + 1);
    if (row.role === "owner") owners.add(row.vendor_id as string);
  }
  const issued = new Set((tokens.data ?? []).map((row) => row.vendor_id as string));

  const shops = (vendors.data ?? [])
    // 運営アカウントの行（vendors.role が admin など）は店舗ではない
    .filter((row) => (row.role ?? "vendor") === "vendor")
    .map((row) => {
      const id = row.id as string;
      const state: ShopClaimState = owners.has(id) ? "claimed" : issued.has(id) ? "qr_issued" : "unclaimed";
      return { vendorId: id, shopName: row.shop_name as string, state, memberCount: memberCounts.get(id) ?? 0 };
    });

  return NextResponse.json({ shops });
}

/**
 * POST: QR の発行（再発行）と、紐づけの解除。
 *   { action: "issue", vendorIds: [...] }  … 前の QR は無効になる。URL は、この応答でしか見せない
 *   { action: "unlink", vendorId, confirm: true } … メンバー全員を外し、店舗をアカウントなしに戻す（店舗のデータは残る）
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;
  const { user, role, adminClient } = auth;
  const db = adminClient as unknown as SupabaseClient;
  const actor = { id: user.id, email: user.email, role };

  const parsed = ClaimActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "操作の内容を確かめてください" }, { status: 400 });
  const input = parsed.data;

  if (input.action === "unlink") {
    const { data: shop } = await db.from("vendors").select("shop_name").eq("id", input.vendorId).maybeSingle();
    const { data: removed, error } = await db.rpc("unlink_shop", { p_vendor_id: input.vendorId });
    if (error) {
      console.error("[admin/shop-claims] unlink error:", error.message);
      return NextResponse.json({ error: "解除できませんでした" }, { status: 500 });
    }
    if (removed === -1) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    const shopName = (shop?.shop_name as string | undefined) ?? null;
    await Promise.all([
      logAdminAudit(adminClient, actor, {
        action: "shop_claim_unlink",
        targetType: "shop",
        targetId: input.vendorId,
        targetName: shopName,
        details: JSON.stringify({ removedMembers: removed }),
      }),
      logVendorActivities(db, [
        {
          vendorId: input.vendorId,
          actorId: user.id,
          actorName: OPERATOR_NAME,
          action: "qr.unlink",
          summary: `運営が店舗との紐づけを解除した（${removed}人が外れた）`,
        },
      ]),
    ]);
    return NextResponse.json({ ok: true, removedMembers: removed });
  }

  const ids = [...new Set(input.vendorIds)];
  const { data: shops, error: shopsError } = await db.from("vendors").select("id, shop_name").in("id", ids);
  if (shopsError) return NextResponse.json({ error: "読み込めませんでした" }, { status: 500 });
  const names = new Map((shops ?? []).map((row) => [row.id as string, row.shop_name as string]));

  const origin = new URL(request.url).origin;
  type Result = { vendorId: string; shopName: string | null; status: "ok" | "no_shop" | "already_claimed" | "error"; url?: string };
  const results: Result[] = [];
  for (let i = 0; i < ids.length; i += ISSUE_CONCURRENCY) {
    const chunk = ids.slice(i, i + ISSUE_CONCURRENCY);
    results.push(
      ...(await Promise.all(
        chunk.map(async (vendorId): Promise<Result> => {
          const shopName = names.get(vendorId) ?? null;
          const token = generateInviteToken();
          const { data, error } = await db.rpc("issue_shop_claim_token", {
            p_vendor_id: vendorId,
            p_token_hash: hashInviteToken(token),
            p_created_by: user.id,
          });
          if (error) {
            console.error("[admin/shop-claims] issue error:", error.message);
            return { vendorId, shopName, status: "error" };
          }
          if (data !== "ok") return { vendorId, shopName, status: data as "no_shop" | "already_claimed" };
          return { vendorId, shopName, status: "ok", url: `${origin}/claim/${token}` };
        }),
      )),
    );
  }

  const issued = results.filter((r) => r.status === "ok");
  await Promise.all([
    logAdminAudit(adminClient, actor, {
      action: "shop_claim_issue",
      targetType: "shop",
      targetId: issued.length === 1 ? issued[0].vendorId : null,
      targetName: issued.length === 1 ? issued[0].shopName : `${issued.length}店舗`,
      details: JSON.stringify({ requested: ids.length, issued: issued.length }),
    }),
    logVendorActivities(
      db,
      issued.map((r) => ({
        vendorId: r.vendorId,
        actorId: user.id,
        actorName: OPERATOR_NAME,
        action: "qr.issue" as const,
        summary: "運営がQRコードを発行した",
      })),
    ),
  ]);

  return NextResponse.json({ results });
}
