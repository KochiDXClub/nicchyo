import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * おでかけサポートの利用ログ（guide_events）を書き込む。
 * shop-interaction と同じく、書き込みは service role だけ（クライアントからの直接 INSERT は不可）。
 */

const EVENT_TYPES = ["open", "navigation_start", "arrived", "navigation_stop"] as const;
type GuideEventType = (typeof EVENT_TYPES)[number];
const KINDS = ["restroom", "rest", "transit", "landmark"] as const;
const ORIGIN_TYPES = ["geolocation", "map-center", "spot", "venue"] as const;

type Body = {
  visitor_key?: string | null;
  event_type?: string;
  preset_id?: string | null;
  kinds?: unknown;
  spot_key?: string | null;
  origin_type?: string | null;
  walk_minutes?: number | null;
  distance_meters?: number | null;
  meta?: Record<string, unknown> | null;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createServiceClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const shortText = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.length > 0 && value.length <= max ? value : null;

const smallInt = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 100000 ? Math.round(value) : null;

export async function POST(request: Request) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "analytics-guide-event",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const body = (await request.json()) as Body | null;
    if (!body || !EVENT_TYPES.includes(body.event_type as GuideEventType)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const kinds = Array.isArray(body.kinds)
      ? body.kinds.filter((k): k is (typeof KINDS)[number] => KINDS.includes(k as (typeof KINDS)[number]))
      : [];
    const originType = ORIGIN_TYPES.includes(body.origin_type as (typeof ORIGIN_TYPES)[number])
      ? (body.origin_type as string)
      : null;

    const serviceClient = getServiceClient();
    const { error } = await serviceClient.from("guide_events").insert({
      visitor_key: shortText(body.visitor_key, 128),
      event_type: body.event_type as GuideEventType,
      preset_id: shortText(body.preset_id, 40),
      kinds,
      spot_key: shortText(body.spot_key, 80),
      origin_type: originType,
      walk_minutes: smallInt(body.walk_minutes),
      distance_meters: smallInt(body.distance_meters),
      meta: body.meta && typeof body.meta === "object" ? (JSON.parse(JSON.stringify(body.meta)) as Json) : null,
    });

    if (error) {
      console.error("[guide-event] insert error:", error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[guide-event] failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
