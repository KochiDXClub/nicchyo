import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { createAdminClient } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TARGET_TYPES = ["vendor", "content", "kotodute"] as const;
type TargetType = typeof VALID_TARGET_TYPES[number];

const VALID_REASONS = [
  "誤った情報",
  "不適切なコンテンツ",
  "スパム・宣伝",
  "著作権侵害",
  "その他",
] as const;

export async function POST(req: Request) {
  const rateLimited = await enforceRateLimit(req, {
    bucket: "reports-post",
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const body = await req.json() as {
    target_type?: string;
    target_id?: string;
    target_name?: string;
    reason?: string;
    details?: string;
  };

  const targetType = body.target_type as TargetType | undefined;
  const targetId = (body.target_id ?? "").trim();
  const targetName = (body.target_name ?? "").trim().slice(0, 200);
  const reason = (body.reason ?? "").trim();
  const details = (body.details ?? "").trim().slice(0, 1000);

  if (!targetType || !VALID_TARGET_TYPES.includes(targetType)) {
    return NextResponse.json({ error: "無効な通報対象です" }, { status: 400 });
  }
  if (!targetId) {
    return NextResponse.json({ error: "対象IDが必要です" }, { status: 400 });
  }
  if (!reason || !VALID_REASONS.includes(reason as typeof VALID_REASONS[number])) {
    return NextResponse.json({ error: "通報理由を選択してください" }, { status: 400 });
  }

  const dc = createAdminClient();
  if (!dc) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: report, error } = await dc.from("reports").insert({
    target_type: targetType,
    target_id: targetId,
    target_name: targetName || null,
    reason,
    details: details || null,
    reporter_id: user?.id ?? null,
    reporter_email: user?.email ?? null,
    status: "open",
  }).select("id").single();

  if (error) {
    console.error("[reports] insert failed:", error.message);
    return NextResponse.json({ error: "通報の送信に失敗しました" }, { status: 500 });
  }

  // 管理者に通知
  const typeLabels: Record<TargetType, string> = {
    vendor: "出店者",
    content: "投稿コンテンツ",
    kotodute: "ことづて",
  };
  const { error: notifError } = await dc.from("admin_notifications").insert({
    type: "report_received",
    title: `新しい通報が届きました`,
    body: `${typeLabels[targetType]}「${targetName || targetId}」への通報：${reason}`,
    link: "/admin/reports",
  });
  if (notifError) {
    console.warn("[reports] notification insert failed:", notifError.message);
  }

  return NextResponse.json({ ok: true, reportId: report.id });
}
