import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { IssueInitialResponse } from "@/lib/coupons/types";
import { normalizeCouponIssuance } from "@/lib/coupons/types";
import type { SupabaseCouponIssuanceRow } from "@/lib/coupons/types";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { MAX_COUPON_ISSUANCE, JST_MIDNIGHT_UTC_SUFFIX } from "@/lib/constants";

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
 * POST /api/coupons/issue-initial
 *
 * マップ初訪問時に1枚のクーポンを発行する。
 * - 同一 visitor_key + market_date に既発行（issue_reason='initial'）がある場合はスキップ
 * - 既にアクティブなクーポンを保有している場合もスキップ
 * - クーポン機能がOFF / 開催日でない場合は 403
 */
export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = enforceRateLimit(request, {
      bucket: "coupons-issue-initial",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const isDevCouponOverride = process.env.NODE_ENV !== "production";
    const body = (await request.json()) as {
      visitor_key?: string;
      market_date?: string;
    };

    const visitor_key = body.visitor_key?.trim();
    const market_date = body.market_date?.trim();

    if (!visitor_key || !market_date) {
      return NextResponse.json(
        { error: "visitor_key and market_date are required" },
        { status: 400 }
      );
    }
    // market_date フォーマット検証 (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(market_date)) {
      return NextResponse.json({ error: "Invalid market_date format" }, { status: 400 });
    }

    const supabase = getServiceClient();

    // ① クーポン機能の有効確認
    const { data: settings } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "coupon")
      .maybeSingle();

    const couponSettings = settings?.value as {
      enabled?: boolean;
      amount?: number;
      maxDailyIssuance?: number;
    } | null;

    if (!isDevCouponOverride && couponSettings?.enabled === false) {
      return NextResponse.json({ error: "Coupon feature is disabled" }, { status: 403 });
    }

    // ② 今日が開催日かどうか確認
    const { count: marketDayCount } = await supabase
      .from("location_assignments")
      .select("id", { count: "exact", head: true })
      .eq("market_date", market_date);

    if (!isDevCouponOverride && (!marketDayCount || marketDayCount === 0)) {
      return NextResponse.json({ error: "Not a market day" }, { status: 403 });
    }

    // ③ 既にアクティブなクーポンがあればスキップ（1枚しか持てない）
    const now = new Date().toISOString();
    const { data: activeCoupons } = await supabase
      .from("coupon_issuances")
      .select("id, coupon_type_id, amount, expires_at, coupon_types(*)")
      .eq("visitor_key", visitor_key)
      .eq("market_date", market_date)
      .eq("is_used", false)
      .gt("expires_at", now)
      .limit(1);

    if (activeCoupons && activeCoupons.length > 0) {
      // 既に保有中 → issued: false で返す
      const c = activeCoupons[0];
      return NextResponse.json({
        issued: false,
        coupon: { ...c, coupon_type: c.coupon_types ?? null },
      });
    }

    // ④ 当日発行上限チェック
    const maxIssuance = couponSettings?.maxDailyIssuance ?? MAX_COUPON_ISSUANCE;
    const { count: todayCount } = await supabase
      .from("coupon_issuances")
      .select("id", { count: "exact", head: true })
      .eq("market_date", market_date);

    if ((todayCount ?? 0) >= maxIssuance) {
      // 上限到達 → 静かにスキップ（ユーザーへはエラーにしない）
      return NextResponse.json({ issued: false, coupon: null } satisfies IssueInitialResponse);
    }

    // ⑤ 初回配布クーポン種類を取得（is_initial_gift=true のもの）
    const { data: initialType } = await supabase
      .from("coupon_types")
      .select("*")
      .eq("is_initial_gift", true)
      .eq("is_enabled", true)
      .order("display_order", { ascending: true })
      .maybeSingle();

    if (!initialType) {
      return NextResponse.json(
        { error: "No initial gift coupon type configured" },
        { status: 500 }
      );
    }

    // ⑥ 発行（expires_at = market_date の翌日 00:00 JST）
    const expiresAt = new Date(`${market_date}${JST_MIDNIGHT_UTC_SUFFIX}`);
    expiresAt.setDate(expiresAt.getDate() + 1);

    const { data: newCoupon, error: insertError } = await supabase
      .from("coupon_issuances")
      .insert({
        visitor_key,
        market_date,
        coupon_type_id: initialType.id,
        amount: couponSettings?.amount ?? initialType.amount,
        issue_reason: "initial",
        expires_at: expiresAt.toISOString(),
      })
      .select("*, coupon_types(*)")
      .single();

    if (insertError) {
      // UNIQUE 違反（並列リクエスト）は冪等に処理
      if (insertError.code === "23505") {
        return NextResponse.json({ issued: false, coupon: null } satisfies IssueInitialResponse);
      }
      console.error("[issue-initial] insert error:", insertError);
      return NextResponse.json({ error: "Failed to issue coupon" }, { status: 500 });
    }

    const coupon = newCoupon ? normalizeCouponIssuance(newCoupon as SupabaseCouponIssuanceRow) : null;
    return NextResponse.json({ issued: true, coupon });
  } catch (err) {
    console.error("[issue-initial] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
