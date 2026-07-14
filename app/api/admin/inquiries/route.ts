import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isModerator } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function authorizeRequest() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isModerator(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}

export type InquiryStatus = "open" | "in_progress" | "resolved" | "closed";

export interface Inquiry {
  id: string;
  name: string | null;
  email: string;
  category: string;
  message: string;
  user_id: string | null;
  status: InquiryStatus;
  assigned_to: string | null;
  reply_notes: string | null;
  replied_by: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { error } = await authorizeRequest();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const limit = Math.min(Number(searchParams.get("limit") ?? "100"), 200);

  let query = dc.from("inquiries").select("*").order("created_at", { ascending: false }).limit(limit);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  const { data, error: dbError } = await query;
  if (dbError) {
    console.error("[admin/inquiries] fetch error:", dbError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ inquiries: data as Inquiry[] });
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
    status?: InquiryStatus;
    reply_notes?: string;
  };

  const { id, status, reply_notes } = body;
  if (!id || !status) return NextResponse.json({ error: "id と status は必須です" }, { status: 400 });

  const validStatuses: InquiryStatus[] = ["open", "in_progress", "resolved", "closed"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { status };
  if (reply_notes !== undefined) {
    updates.reply_notes = reply_notes.slice(0, 1000) || null;
    updates.replied_by = user.id;
    updates.replied_at = new Date().toISOString();
  }

  const { error: dbError } = await dc.from("inquiries").update(updates).eq("id", id);
  if (dbError) {
    console.error("[admin/inquiries] update error:", dbError.message);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "inquiry_status_changed",
    target_type: "inquiry",
    target_id: id,
    details: JSON.stringify({ status, has_reply: !!reply_notes }),
  });

  return NextResponse.json({ ok: true });
}
