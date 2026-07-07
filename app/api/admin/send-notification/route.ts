import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import { sendEmail, isEmailConfigured } from "@/lib/email/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    configured: isEmailConfigured(),
    fromAddress: process.env.NOTIFICATION_FROM_EMAIL ?? "未設定（noreply@nicchyo.jp を使用）",
    notificationTo: process.env.ADMIN_NOTIFICATION_EMAIL ?? "未設定",
  });
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdmin(getRole(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { to?: string };
  const to = (process.env.ADMIN_NOTIFICATION_EMAIL ?? "").trim();

  if (!to) {
    return NextResponse.json({ error: "送信先メールアドレスを指定してください（.env の ADMIN_NOTIFICATION_EMAIL が未設定）" }, { status: 400 });
  }

  // 任意アドレスへの送信を防ぐため、指定先は設定済みの通知アドレスと一致する場合のみ許可する
  const requestedTo = (body.to ?? "").trim();
  if (requestedTo && requestedTo !== to) {
    return NextResponse.json({ error: "設定されたメールアドレス以外への送信はできません" }, { status: 403 });
  }

  const result = await sendEmail({
    to,
    subject: "【nicchyo】メール通知テスト",
    html: `<h2>テストメール</h2><p>nicchyo のメール通知設定が正しく機能しています。</p><p>送信者: ${user.email}</p>`,
    text: `nicchyo メール通知テスト\n送信者: ${user.email}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "送信に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, skipped: result.skipped ?? false, id: result.id });
}
