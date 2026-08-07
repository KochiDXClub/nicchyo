import { NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import { MAX_BULK_OPERATION } from "@/lib/constants";
import { sendBulkEmails } from "@/lib/email/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RecipientMode = "all" | "vendor" | "general_user" | "moderator" | "custom";

type RequestBody = {
  recipientMode: RecipientMode;
  customEmails?: string[];
  subject: string;
  body: string;
};

function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return local.length <= 64 && domain.length > 0 && domain.includes(".") && !domain.endsWith(".");
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<div style="font-family:sans-serif;white-space:pre-wrap;">${escaped.replace(/\n/g, "<br>")}</div>`;
}

async function resolveRecipients(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  serviceClient: SupabaseClient<any, any, any>,
  recipientMode: RecipientMode,
  customEmails?: string[]
): Promise<string[] | { error: string }> {
  if (recipientMode === "custom") {
    const emails = (customEmails ?? []).map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) return { error: "送信先メールアドレスを入力してください" };
    const invalid = emails.find((e) => !isValidEmail(e));
    if (invalid) return { error: `メールアドレスの形式が正しくありません: ${invalid}` };
    return Array.from(new Set(emails));
  }

  const allUsers: Array<{ email?: string; role: string }> = [];
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) return { error: "ユーザー一覧の取得に失敗しました" };
    const pageUsers = data.users ?? [];
    allUsers.push(
      ...pageUsers.map((u) => ({
        email: u.email,
        role: (u.app_metadata?.role as string | undefined) ?? "general_user",
      }))
    );
    if (pageUsers.length < perPage) break;
    page += 1;
  }

  const filtered = allUsers.filter((u) => {
    if (!u.email) return false;
    if (recipientMode === "all") return true;
    return u.role === recipientMode;
  });

  return Array.from(new Set(filtered.map((u) => u.email as string)));
}

export async function POST(req: Request) {
  const originCheck = requireSameOrigin(req);
  if (!originCheck.ok) return originCheck.response;

  const rateLimited = await enforceRateLimit(req, {
    bucket: "admin-broadcast-email",
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimited) return rateLimited;

  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(getRole(user))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase env missing" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const subject = body.subject?.trim() ?? "";
  const message = body.body?.trim() ?? "";
  if (!subject || subject.length > 200) {
    return NextResponse.json({ error: "件名を1〜200文字で入力してください" }, { status: 400 });
  }
  if (!message || message.length > 5000) {
    return NextResponse.json({ error: "本文を1〜5000文字で入力してください" }, { status: 400 });
  }

  const validModes: RecipientMode[] = ["all", "vendor", "general_user", "moderator", "custom"];
  if (!validModes.includes(body.recipientMode)) {
    return NextResponse.json({ error: "送信対象が不正です" }, { status: 400 });
  }

  const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const recipientsResult = await resolveRecipients(serviceClient, body.recipientMode, body.customEmails);
  if (!Array.isArray(recipientsResult)) {
    return NextResponse.json({ error: recipientsResult.error }, { status: 400 });
  }

  if (recipientsResult.length === 0) {
    return NextResponse.json({ error: "送信対象が0件です" }, { status: 400 });
  }
  if (recipientsResult.length > MAX_BULK_OPERATION) {
    return NextResponse.json(
      { error: `一度に送信できるのは${MAX_BULK_OPERATION}件までです（対象: ${recipientsResult.length}件）` },
      { status: 400 }
    );
  }

  const html = textToHtml(message);
  const { sentCount, failedRecipients, skipped } = await sendBulkEmails({
    recipients: recipientsResult,
    subject,
    html,
    text: message,
  });

  await serviceClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    actor_email: user.email,
    actor_role: getRole(user),
    action: "broadcast_email",
    target_type: "email",
    details: `「${subject}」を${recipientsResult.length}件へ送信`,
  });

  return NextResponse.json({
    ok: true,
    sentCount,
    failedCount: failedRecipients.length,
    totalCount: recipientsResult.length,
    skipped: skipped ?? false,
  });
}
