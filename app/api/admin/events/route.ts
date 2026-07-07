import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { authorizeAdmin } from "./_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface MarketEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(req: Request) {
  const { error } = await authorizeAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const includeUnpublished = searchParams.get("all") === "1";

  let query = dc
    .from("market_events")
    .select("*")
    .order("event_date", { ascending: false })
    .limit(200);

  if (!includeUnpublished) {
    query = query.eq("is_published", true);
  }

  const { data, error: dbError } = await query;
  if (dbError) {
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ events: data as MarketEvent[] });
}

function validateEventBody(body: unknown): { data: Partial<MarketEvent>; error: string | null } {
  if (!body || typeof body !== "object") return { data: {}, error: "無効なリクエストです" };
  const b = body as Record<string, unknown>;

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title || title.length > 100) return { data: {}, error: "タイトルは1〜100文字で入力してください" };

  const eventDate = typeof b.event_date === "string" ? b.event_date.trim() : "";
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    return { data: {}, error: "開催日の形式が無効です（YYYY-MM-DD）" };
  }

  const timePattern = /^\d{2}:\d{2}$/;
  if (typeof b.start_time === "string" && b.start_time && !timePattern.test(b.start_time)) {
    return { data: {}, error: "開始時刻の形式が無効です（HH:MM）" };
  }
  if (typeof b.end_time === "string" && b.end_time && !timePattern.test(b.end_time)) {
    return { data: {}, error: "終了時刻の形式が無効です（HH:MM）" };
  }

  return {
    data: {
      title,
      description: typeof b.description === "string" ? b.description.trim().slice(0, 1000) || null : null,
      event_date: eventDate,
      start_time: typeof b.start_time === "string" && b.start_time ? b.start_time : null,
      end_time: typeof b.end_time === "string" && b.end_time ? b.end_time : null,
      location: typeof b.location === "string" ? b.location.trim().slice(0, 200) || null : null,
      is_published: b.is_published === true,
    },
    error: null,
  };
}

export async function POST(req: Request) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json() as unknown;
  const { data, error: validError } = validateEventBody(body);
  if (validError) return NextResponse.json({ error: validError }, { status: 400 });

  const { data: event, error: dbError } = await dc
    .from("market_events")
    .insert({ ...data, created_by: user.id })
    .select("*")
    .single();

  if (dbError) {
    return NextResponse.json({ error: "作成に失敗しました" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "event_created",
    target_type: "market_event",
    target_id: (event as MarketEvent).id,
    details: JSON.stringify({ title: data.title }),
  });

  return NextResponse.json({ event: event as MarketEvent }, { status: 201 });
}
