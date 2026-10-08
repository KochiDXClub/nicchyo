import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { createAdminClient } from "@/lib/supabase/adminClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_CATEGORIES = ["question", "feedback", "bug", "sponsor", "other"] as const;

function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return local.length <= 64 && domain.length > 0 && domain.includes(".") && !domain.endsWith(".");
}

// 型と極端な長さをここで弾く。細かい文言の検証は下で従来どおり行う（欠けた項目は後段で個別のエラーにする）
const contactSchema = z.object({
  name: z.string().max(1000).optional(),
  email: z.string().max(254).optional(),
  category: z.string().max(32).optional(),
  message: z.string().max(5000).optional(),
  // honeypot: 人間には見えない欄。値が入っていたらボット
  website: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "contact-post",
    limit: 3,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const raw = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容が正しくありません" }, { status: 400 });
  }
  const body = parsed.data;

  // ボットには成功を装い、何も保存・通知しない
  if (body.website) {
    return NextResponse.json({ ok: true });
  }

  const name = (body.name ?? "").trim().slice(0, 100) || null;
  const email = (body.email ?? "").trim().toLowerCase();
  const category = (body.category ?? "").trim();
  const message = (body.message ?? "").trim();

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "メールアドレスが無効です" }, { status: 400 });
  }
  if (!VALID_CATEGORIES.includes(category as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: "カテゴリが無効です" }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json({ error: "内容は10文字以上で入力してください" }, { status: 400 });
  }
  if (message.length > 1000) {
    return NextResponse.json({ error: "内容は1000文字以内で入力してください" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const dc = createAdminClient();
  if (!dc) {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  const { data: inquiry, error } = await dc.from("inquiries").insert({
    name,
    email,
    category,
    message,
    user_id: user?.id ?? null,
    status: "open",
  }).select("id").single();

  if (error) {
    console.error("[contact] insert failed:", error.message);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }

  // 管理者に通知
  const categoryLabels: Record<string, string> = {
    question: "ご質問",
    feedback: "ご意見",
    bug: "不具合・トラブル",
    sponsor: "協賛・支援",
    other: "その他",
  };
  const { error: notifError } = await dc.from("admin_notifications").insert({
    type: "inquiry_received",
    title: "新しいお問い合わせが届きました",
    body: `[${categoryLabels[category] ?? category}] ${name ?? email}より`,
    link: "/admin/inquiries",
  });
  if (notifError) {
    console.warn("[contact] notification insert failed:", notifError.message);
  }

  return NextResponse.json({ ok: true, inquiryId: inquiry.id });
}
