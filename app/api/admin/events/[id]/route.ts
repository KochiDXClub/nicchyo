import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorizeAdmin() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}

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
  if ("start_time" in body) updates.start_time = body.start_time || null;
  if ("end_time" in body) updates.end_time = body.end_time || null;
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
