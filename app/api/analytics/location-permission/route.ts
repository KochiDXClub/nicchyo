import { NextResponse } from "next/server";

import { isAnalyticsCollectionEnabled } from "@/lib/analytics/collectionSettings.server";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 位置情報の許可・拒否の件数を 1 増やす（匿名の合計だけ）。
 * 受け取るのは choice（"allowed" か "denied"）だけ。ID・IP・位置情報は受け取らず、保存もしない。
 * 書き込みは service role の関数経由（クライアントからの直接書き込みは不可）。
 */

const CHOICES = ["allowed", "denied"] as const;
type Choice = (typeof CHOICES)[number];
const MAX_BODY_BYTES = 1024;

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "analytics-location-permission",
      // 同じ回線（会場の Wi-Fi・携帯の CGNAT）を多くの来訪者が共有するため、
      // 正当な利用を落とさない範囲で上限を置く（正確な件数ではなく下限の目安として読む）
      limit: 30,
      windowMs: 60 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    if (!(await isAnalyticsCollectionEnabled("locationPermission"))) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // 本文は {"choice":"allowed"} だけなので、大きいものは読まずに弾く
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Payload too large" }, { status: 413 });

    const body = (await request.json().catch(() => null)) as { choice?: unknown } | null;
    if (!body || !CHOICES.includes(body.choice as Choice)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ ok: false }, { status: 500 });

    const { error } = await admin.rpc("increment_location_permission_count", {
      p_choice: body.choice as Choice,
    });

    if (error) {
      console.error("[location-permission] increment error:", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[location-permission] failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
