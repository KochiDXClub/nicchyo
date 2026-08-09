import { NextResponse } from "next/server";
import { getRole } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/adminClient";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeAdmin, validateImageUrl } from "../_helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const VALID_EVENT_CATEGORIES: readonly string[] = ["vendor", "event", "season", "notice"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function PATCH(req: Request, { params }: Params) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-events-patch",
    limit: 60,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "IDが無効です" }, { status: 400 });
  }

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "無効なリクエストです" }, { status: 400 });
  }
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
    if (!DATE_PATTERN.test(body.event_date)) {
      return NextResponse.json({ error: "開催日の形式が無効です" }, { status: 400 });
    }
    updates.event_date = body.event_date;
  }
  if ("end_date" in body) {
    const v = body.end_date;
    if (v === null || v === "") {
      updates.end_date = null;
    } else if (typeof v !== "string" || !DATE_PATTERN.test(v)) {
      return NextResponse.json({ error: "終了日の形式が無効です（YYYY-MM-DD）" }, { status: 400 });
    } else {
      updates.end_date = v;
    }
  }
  // 開始日・終了日が両方来た場合の前後関係だけはここで見る
  // （片方だけの更新は DB の CHECK 制約が最終防衛線になる）
  if (
    typeof updates.event_date === "string" &&
    typeof updates.end_date === "string" &&
    updates.end_date < updates.event_date
  ) {
    return NextResponse.json({ error: "終了日は開催日以降にしてください" }, { status: 400 });
  }

  const timePattern = /^\d{2}:\d{2}$/;
  // 非文字列を素通りさせると PostgREST まで届いて 500 になるため、ここで 400 にする
  for (const key of ["start_time", "end_time"] as const) {
    if (!(key in body)) continue;
    const v = body[key];
    if (v === null || v === "") {
      updates[key] = null;
      continue;
    }
    if (typeof v !== "string" || !timePattern.test(v)) {
      const label = key === "start_time" ? "開始時刻" : "終了時刻";
      return NextResponse.json({ error: `${label}の形式が無効です（HH:MM）` }, { status: 400 });
    }
    updates[key] = v;
  }
  if ("location" in body) {
    updates.location = typeof body.location === "string" ? body.location.trim().slice(0, 200) || null : null;
  }
  if (typeof body.is_published === "boolean") {
    updates.is_published = body.is_published;
  }
  if ("category" in body) {
    if (!VALID_EVENT_CATEGORIES.includes(body.category as string)) {
      return NextResponse.json({ error: "種別が無効です" }, { status: 400 });
    }
    updates.category = body.category;
  }
  if ("image_url" in body) {
    const { url, error: imageError } = validateImageUrl(body.image_url);
    if (imageError) return NextResponse.json({ error: imageError }, { status: 400 });
    updates.image_url = url;
  }
  if (typeof body.is_highlight === "boolean") {
    updates.is_highlight = body.is_highlight;
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

  if (dbError?.code === "23505") {
    return NextResponse.json(
      { error: "この日にはすでに見どころが設定されています" },
      { status: 409 }
    );
  }
  if (dbError) {
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
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

export async function DELETE(req: Request, { params }: Params) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-events-delete",
    limit: 30,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const { user, error } = await authorizeAdmin();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "IDが無効です" }, { status: 400 });
  }

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  // 存在しない ID でも成功扱いにすると監査ログだけが積まれるため、削除結果を見る
  const { data: deleted, error: dbError } = await dc
    .from("market_events")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (dbError) {
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
  if (!deleted) {
    return NextResponse.json({ error: "イベントが見つかりません" }, { status: 404 });
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
