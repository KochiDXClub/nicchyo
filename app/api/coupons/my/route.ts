import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MyCouponsResponse, CouponIssuance, CouponType } from "@/lib/coupons/types";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * GET /api/coupons/my?visitor_key=xxx&market_date=YYYY-MM-DD
 *
 * visitor_key の当日クーポン・スタンプ・参加店情報を返す公開API。
 */
export async function GET(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "coupons-my",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const { searchParams } = new URL(request.url);
    const visitor_key = searchParams.get("visitor_key")?.trim();
    const market_date = searchParams.get("market_date")?.trim();

    if (!visitor_key || !market_date) {
      return NextResponse.json(
        { error: "visitor_key and market_date are required" },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(market_date)) {
      return NextResponse.json({ error: "Invalid market_date format" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ① 開催日チェック
    const { count: marketDayCount } = await supabase
      .from("location_assignments")
      .select("id", { count: "exact", head: true })
      .eq("market_date", market_date);

    const is_market_day = (marketDayCount ?? 0) > 0;

    // ② アクティブなクーポン（1枚 or 0枚）
    const now = new Date().toISOString();
    const { data: activeCoupons } = await supabase
      .from("coupon_issuances")
      .select("*, coupon_types(*)")
      .eq("visitor_key", visitor_key)
      .eq("market_date", market_date)
      .eq("is_used", false)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1);

    // SupabaseのJOIN結果 coupon_types → coupon_type に正規化
    const active_coupon =
      activeCoupons && activeCoupons.length > 0
        ? ({
            ...activeCoupons[0],
            coupon_type: activeCoupons[0].coupon_types ?? null,
          } as CouponIssuance & { coupon_type: CouponType })
        : null;

    // ③ 当日スタンプ一覧
    const { data: stampRows } = await supabase
      .from("coupon_stamps")
      .select("vendor_id, created_at, vendors(shop_name)")
      .eq("visitor_key", visitor_key)
      .eq("market_date", market_date)
      .order("created_at", { ascending: true });

    const stamps = (stampRows ?? []).map((s) => ({
      vendor_id: s.vendor_id as string,
      vendor_name:
        s.vendors && typeof s.vendors === "object" && !Array.isArray(s.vendors)
          ? (s.vendors as { shop_name: string | null }).shop_name ?? "名称未設定"
          : "名称未設定",
      stamped_at: s.created_at as string,
    }));

    const stampedVendorIds = new Set(stamps.map((s) => s.vendor_id));

    // ④ 参加店一覧（クーポン機能ON の出店者）
    const { data: settingRows } = await supabase
      .from("vendor_coupon_settings")
      .select("vendor_id, coupon_type_id, min_purchase_amount, vendors(shop_name), coupon_types(name, emoji, amount)")
      .eq("is_participating", true);

    const participating_vendors = (settingRows ?? []).map((s) => {
      const vendorName =
        s.vendors && typeof s.vendors === "object" && !Array.isArray(s.vendors)
          ? (s.vendors as { shop_name: string | null }).shop_name ?? "名称未設定"
          : "名称未設定";
      const rawType = s.coupon_types;
      const typeData =
        rawType && !Array.isArray(rawType) && typeof rawType === "object"
          ? (rawType as { name: string; emoji: string; amount?: number })
          : null;
      return {
        vendor_id: s.vendor_id as string,
        vendor_name: vendorName,
        coupon_type_id: s.coupon_type_id as string,
        coupon_type_name: typeData?.name ?? "",
        coupon_type_emoji: typeData?.emoji ?? "🎟️",
        coupon_type_amount:
          rawType && !Array.isArray(rawType) && typeof rawType === "object"
            ? ((rawType as { amount?: number }).amount ?? 50)
            : 50,
        min_purchase_amount: s.min_purchase_amount as 0 | 300 | 500 | 1000,
        is_stamped: stampedVendorIds.has(s.vendor_id as string),
      };
    });

    const response: MyCouponsResponse = {
      active_coupon,
      stamps,
      participating_vendors,
      is_market_day,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("[coupons/my] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
