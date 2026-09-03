import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isModerator } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import type { DatabaseWithExtensions } from "@/types/database.extensions";
import {
  VENDOR_INQUIRY_STATUS_BY_TOPIC,
  isUuid,
  isValidStatusForTopic,
} from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient<DatabaseWithExtensions>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function authorizeRequest() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isModerator(getRole(user))) return { user: null, error: "Forbidden" };
  return { user, error: null };
}

// ─── GET: スレッド詳細+返信一覧（運営は全件参照可） ────────────────
export async function GET(req: Request, { params }: RouteParams) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const { error } = await authorizeRequest();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const { id } = await params;
  // uuid型の列に非UUIDを渡すとPostgreSQLが22P02を返し500になるため、先に弾く
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const { data: inquiry, error: inquiryError } = await dc
    .from("vendor_inquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (inquiryError) {
    console.error("[admin/vendor-inquiries/:id] fetch error:", inquiryError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
  if (!inquiry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: replies, error: repliesError } = await dc
    .from("vendor_inquiry_replies")
    .select("*")
    .eq("inquiry_id", id)
    .order("created_at", { ascending: true });
  if (repliesError) {
    console.error("[admin/vendor-inquiries/:id] replies fetch error:", repliesError.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ inquiry, replies });
}

const UpdateStatusSchema = z.object({
  status: z.string().min(1, "statusは必須です"),
});

// ─── PATCH: ステータス更新（確認済み／検討中／回答済み等への遷移） ─────
export async function PATCH(req: Request, { params }: RouteParams) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  // IP単位は認証前の連打を止める粗い上限。実際の操作数制限は認証後に担当者単位でかける
  const floodLimited = await enforceRateLimit(req, {
    bucket: "admin-vendor-inquiries-patch-ip",
    limit: 300,
    windowMs: 10 * 60 * 1000,
  });
  if (floodLimited) return floodLimited;

  const { user, error } = await authorizeRequest();
  if (error || !user) return NextResponse.json({ error }, { status: 403 });

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-vendor-inquiries-patch",
    limit: 60,
    windowMs: 10 * 60 * 1000,
    keySuffix: user.id,
  });
  if (rateLimited) return rateLimited;

  const { id } = await params;
  // uuid型の列に非UUIDを渡すとPostgreSQLが22P02を返し500になるため、先に弾く
  if (!isUuid(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const dc = createAdminClient();
  if (!dc) return NextResponse.json({ error: "Service unavailable" }, { status: 503 });

  const parsed = UpdateStatusSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { data: current, error: fetchErr } = await dc
    .from("vendor_inquiries")
    .select("topic, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) {
    console.error("[admin/vendor-inquiries/:id] fetch-before-update error:", fetchErr.message);
    return NextResponse.json({ error: "データ取得に失敗しました" }, { status: 500 });
  }
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!isValidStatusForTopic(current.topic, parsed.data.status)) {
    return NextResponse.json(
      {
        error: `topic="${current.topic}" では status は ${VENDOR_INQUIRY_STATUS_BY_TOPIC[current.topic].join(" / ")} のいずれかである必要があります`,
      },
      { status: 400 }
    );
  }

  const { error: updateErr } = await dc.from("vendor_inquiries").update({ status: parsed.data.status }).eq("id", id);
  if (updateErr) {
    console.error("[admin/vendor-inquiries/:id] update error:", updateErr.message);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "vendor_inquiry_status_changed",
    target_type: "vendor_inquiry",
    target_id: id,
    details: JSON.stringify({ from: current.status, to: parsed.data.status }),
  });

  return NextResponse.json({ ok: true });
}
