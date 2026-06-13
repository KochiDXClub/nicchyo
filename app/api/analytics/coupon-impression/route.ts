import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createServiceClient<DatabaseWithExtensions>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "analytics-coupon-impression",
      limit: 30,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const body = (await request.json()) as {
      coupon_id: string;
      visitor_key?: string;
      shop_id?: string;
      source: string;
      placement?: string;
      visible_duration?: number;
    } | null;

    if (!body || typeof body.coupon_id !== "string" || typeof body.source !== "string") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    // coupon_id の存在確認（不正なデータによる分析汚染を防止）
    const { count: couponCount } = await serviceClient
      .from("coupon_issuances")
      .select("id", { count: "exact", head: true })
      .eq("id", body.coupon_id);

    if (!couponCount || couponCount === 0) {
      return NextResponse.json({ error: "Invalid coupon_id" }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for");
    const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : null;

    const { error } = await serviceClient.from("coupon_impressions").insert({
      coupon_id: body.coupon_id,
      visitor_key: body.visitor_key ?? null,
      shop_id: body.shop_id ?? null,
      source: body.source,
      placement: body.placement ?? null,
      visible_duration: typeof body.visible_duration === "number" ? Math.max(0, Math.round(body.visible_duration)) : null,
      ip_address: ip,
    });

    if (error) {
      console.error("[coupon-impression] insert error:", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[coupon-impression] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
