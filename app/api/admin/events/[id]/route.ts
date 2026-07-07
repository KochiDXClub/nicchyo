import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { authorizeAdmin } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title || title.length > 100) return NextResponse.json({ error: "タイトルは1〜100文字で入力してください" }, { status: 400 });
    updates.title = title;
  }
  if ("description" in body) {
    updates.description = typeof body.description === "string" ? body.description.trim().slice(0, 1000) || null : null;
  }
  if (typeof body.event_date === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.event_date)) {
      return NextResponse.json({ error: "開催日の形式が無効です" }, { status: 400 });
    }
    updates.event_date = body.event_date;
  }
  const timePattern = /^\d{2}:\d{2}$/;
  if ("start_time" in body) {
    if (typeof body.start_time === "string" && body.start_time && !timePattern.test(body.start_time)) {
      return NextResponse.json({ error: "開始時刻の形式が無効です（HH:MM）" }, { status: 400 });
    }
    updates.start_time = body.start_time || null;
  }
  if ("end_time" in body) {
    if (typeof body.end_time === "string" && body.end_time && !timePattern.test(body.end_time)) {
      return NextResponse.json({ error: "終了時刻の形式が無効です（HH:MM）" }, { status: 400 });
    }
    updates.end_time = body.end_time || null;
  }
  if ("location" in body) {
    updates.location = typeof body.location === "string" ? body.location.trim().slice(0, 200) || null : null;
  }
  if (typeof body.is_published === "boolean") {
    updates.is_published = body.is_published;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "更新するフィールドがありません" }, { status: 400 });
  }

  const { data, error: dbError } = await dc
    .from("market_events")
    .update(updates)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (dbError || !data) {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "event_updated",
    target_type: "market_event",
    target_id: id,
    details: JSON.stringify(updates),
  });

  return NextResponse.json({ event: data });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { error: dbError } = await dc.from("market_events").delete().eq("id", id);
  if (dbError) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "event_deleted",
    target_type: "market_event",
    target_id: id,
    details: JSON.stringify({}),
  });

  return NextResponse.json({ ok: true });
}
