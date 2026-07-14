import { Resend } from "resend";

// RESEND_API_KEY が未設定の場合はスタブとして機能する（ログのみ出力）
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = process.env.NOTIFICATION_FROM_EMAIL ?? "nicchyo <noreply@nicchyo.jp>";

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
  skipped?: boolean;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    console.log(`[mailer] RESEND_API_KEY not set — skipping email to ${Array.isArray(params.to) ? params.to.join(", ") : params.to}: ${params.subject}`);
    return { ok: true, skipped: true };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    if (error) {
      console.error("[mailer] send failed:", error.message);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[mailer] unexpected error:", msg);
    return { ok: false, error: msg };
  }
}

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
