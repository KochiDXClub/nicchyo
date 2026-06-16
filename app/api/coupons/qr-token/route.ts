import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { CouponQrTokenResponse } from "@/lib/coupons/types";
import {
  createCouponQrToken,
  getSecondsUntilNextCouponQrSlot,
} from "@/lib/coupons/qrToken";
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

export async function GET(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "coupons-qr-token",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const { searchParams } = new URL(request.url);
    const visitorKey = searchParams.get("visitor_key")?.trim();
    const marketDate = searchParams.get("market_date")?.trim();

    if (!visitorKey || !marketDate) {
      return NextResponse.json(
        { error: "visitor_key and market_date are required" },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(marketDate)) {
      return NextResponse.json({ error: "Invalid market_date format" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const nowIso = new Date().toISOString();
    const { data: activeCoupons } = await supabase
      .from("coupon_issuances")
      .select("id")
      .eq("visitor_key", visitorKey)
      .eq("market_date", marketDate)
      .eq("is_used", false)
      .gt("expires_at", nowIso)
      .limit(1);

    if (!activeCoupons || activeCoupons.length === 0) {
      return NextResponse.json({ error: "No active coupon" }, { status: 409 });
    }

    const response: CouponQrTokenResponse = {
      token: createCouponQrToken(visitorKey),
      expires_in_seconds: getSecondsUntilNextCouponQrSlot(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[coupons/qr-token] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
