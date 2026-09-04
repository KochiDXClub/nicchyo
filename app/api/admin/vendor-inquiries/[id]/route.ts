import { NextResponse } from "next/server";
import { z } from "zod";
import { getRole } from "@/lib/auth/permissions";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { authorizeRequest, createAdminClient } from "../_shared";
import {
  VENDOR_INQUIRY_STATUS_BY_TOPIC,
  isUuid,
  isValidStatusForTopic,
} from "@/lib/vendorInquiries/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

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
    // DBのCHECK制約がある限り未知のtopicは入らないが、isValidStatusForTopic 側が
    // `?? false` で防御しているのに合わせ、メッセージ生成側も未知のtopicで落ちないようにする
    const allowed = VENDOR_INQUIRY_STATUS_BY_TOPIC[current.topic] ?? [];
    return NextResponse.json(
      {
        error: `topic="${current.topic}" では status は ${allowed.join(" / ")} のいずれかである必要があります`,
      },
      { status: 400 }
    );
  }

  const { error: updateErr } = await dc.from("vendor_inquiries").update({ status: parsed.data.status }).eq("id", id);
  if (updateErr) {
    console.error("[admin/vendor-inquiries/:id] update error:", updateErr.message);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  // 監査ログの失敗はステータス更新自体を巻き戻さない（更新はすでに成功しているため）が、
  // 黙って落ちると追跡できなくなるのでログには残す
  const { error: auditErr } = await dc.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "vendor_inquiry_status_changed",
    target_type: "vendor_inquiry",
    target_id: id,
    details: JSON.stringify({ from: current.status, to: parsed.data.status }),
  });
  if (auditErr) {
    console.error("[admin/vendor-inquiries/:id] audit log insert failed:", auditErr.message);
  }

  return NextResponse.json({ ok: true });
}
