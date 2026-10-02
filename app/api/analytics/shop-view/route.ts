import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { MAX_SHOP_ID, MIN_SHOP_ID } from "@/lib/shops/route";
import { SHOP_VIEW_SOURCES, type ShopViewSource } from "@/lib/analytics/shopViews";
import { vendorForStore, type Assignment } from "@/lib/analytics/shopVendor";
import { isShopMember } from "@/lib/vendor/shopMembership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/analytics/shop-view  { shopId, source }
 *
 * お店の詳細（地図のバナー・店舗ページ）が開かれたことを、出店者の「お店の分析」のために数える。
 * 保存するのは「どの出店者が・どこから・いつ」だけ。端末や IP などの個人を辿れる値は持たない。
 * 出店者本人が自分のお店を開いた分は数えない。応答はいつも { ok: true }（数えたかどうかは分からない）。
 */
export async function POST(request: Request) {
  const originCheck = requireSameOrigin(request);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(request, {
    bucket: "analytics-shop-view",
    limit: 120,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const body = (await request.json().catch(() => null)) as { shopId?: unknown; source?: unknown } | null;
  const shopId = body?.shopId;
  if (typeof shopId !== "number" || !Number.isInteger(shopId) || shopId < MIN_SHOP_ID || shopId > MAX_SHOP_ID) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const source: ShopViewSource = SHOP_VIEW_SOURCES.includes(body?.source as ShopViewSource)
    ? (body?.source as ShopViewSource)
    : "direct";

  // 同じ IP から1つのお店を何度も数えさせない
  const perShopLimited = await enforceRateLimit(request, {
    bucket: "analytics-shop-view-per-shop",
    limit: 10,
    windowMs: 10 * 60 * 1000,
    keySuffix: String(shopId),
  });
  if (perShopLimited) return perShopLimited;

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // 店番号 → 出店者。地図と同じく、自分のいちばん新しい配置がその屋台にある出店者
  // （決まらないときは記録しない。詳しくは lib/analytics/shopVendor.ts）
  const { data: locations } = await admin.from("market_locations").select("id").eq("store_number", shopId);
  const locationIds = new Set((locations ?? []).map((row) => row.id as string));
  if (locationIds.size === 0) return NextResponse.json({ ok: true });

  const { data: here } = await admin
    .from("location_assignments")
    .select("vendor_id")
    .in("location_id", [...locationIds]);
  const candidates = [...new Set((here ?? []).map((row) => row.vendor_id as string | null).filter((id): id is string => !!id))];
  if (candidates.length === 0) return NextResponse.json({ ok: true });

  const { data: assignments } = await admin
    .from("location_assignments")
    .select("vendor_id, location_id, market_date")
    .in("vendor_id", candidates);
  const vendorId = vendorForStore((assignments ?? []) as Assignment[], locationIds);
  if (!vendorId) return NextResponse.json({ ok: true });

  const cookieStore = await cookies();
  const {
    data: { user },
  } = await createServerClient(cookieStore).auth.getUser();
  // 店舗のメンバー（代表者・招待されたメンバー）が自分のお店を開いた分は数えない。user.id は店舗の ID とは別物
  if (user && (await isShopMember(admin as unknown as SupabaseClient, user.id, vendorId))) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await admin.from("shop_page_views").insert({ vendor_id: vendorId, source });
  if (error) {
    console.error("[shop-view] insert error:", error);
    return NextResponse.json({ error: "記録できませんでした" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
