import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isModerator } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { createAdminClient } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function authorizeRequest() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isModerator(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}

export type ReportStatus = "open" | "in_review" | "resolved" | "dismissed";

export interface Report {
  id: string;
  target_type: string;
  target_id: string;
  target_name: string | null;
  reason: string;
  details: string | null;
  reporter_id: string | null;
  reporter_email: string | null;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(req: Request) {
  const { error } = await authorizeRequest();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const targetType = searchParams.get("target_type");
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

  let query = dc.from("reports").select("*").order("created_at", { ascending: false }).limit(limit);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (targetType && targetType !== "all") {
    query = query.eq("target_type", targetType);
  }

  const { data, error: dbError } = await query;
  if (dbError) {
    console.error("[admin/reports] fetch error:", dbError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ reports: data as Report[] });
}

export async function PATCH(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { user, error } = await authorizeRequest();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const body = await req.json() as {
    id?: string;
    status?: ReportStatus;
    resolution_notes?: string;
  };

  const { id, status, resolution_notes } = body;
  if (!id || !status) return NextResponse.json({ error: "id と status は必須です" }, { status: 400 });

  const validStatuses: ReportStatus[] = ["open", "in_review", "resolved", "dismissed"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "resolved" || status === "dismissed") {
    updates.resolved_by = user.id;
    updates.resolved_at = new Date().toISOString();
    if (resolution_notes) updates.resolution_notes = resolution_notes.slice(0, 500);
  }

  const { error: dbError } = await dc.from("reports").update(updates).eq("id", id);
  if (dbError) {
    console.error("[admin/reports] update error:", dbError.message);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  // 監査ログ
  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "report_status_changed",
    target_type: "report",
    target_id: id,
    details: JSON.stringify({ status, resolution_notes: resolution_notes ?? null }),
  });

  return NextResponse.json({ ok: true });
}
