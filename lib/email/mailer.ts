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

export interface SendBulkEmailsParams {
  recipients: string[];
  subject: string;
  html: string;
  text?: string;
}

export interface SendBulkEmailsResult {
  sentCount: number;
  failedRecipients: string[];
  skipped?: boolean;
}

const BATCH_CHUNK_SIZE = 100;

function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

// 受信者ごとに個別メールとして送信する（to に配列を渡すと受信者同士にメールアドレスが見えてしまうため）
export async function sendBulkEmails(params: SendBulkEmailsParams): Promise<SendBulkEmailsResult> {
  if (!resend) {
    console.log(`[mailer] RESEND_API_KEY not set — skipping bulk email to ${params.recipients.length} recipients: ${params.subject}`);
    return { sentCount: 0, failedRecipients: [], skipped: true };
  }

  const failedRecipients: string[] = [];
  let sentCount = 0;

  for (const batch of chunk(params.recipients, BATCH_CHUNK_SIZE)) {
    try {
      const { data, error } = await resend.batch.send(
        batch.map((to) => ({
          from: FROM_ADDRESS,
          to: [to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }))
      );

      if (error) {
        console.error("[mailer] bulk send failed:", error.message);
        failedRecipients.push(...batch);
        continue;
      }

      sentCount += data?.data?.length ?? batch.length;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[mailer] bulk send unexpected error:", msg);
      failedRecipients.push(...batch);
    }
  }

  return { sentCount, failedRecipients };
}
