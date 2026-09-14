import type { LineOutgoingMessage } from "./types";

const LINE_REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";
const DEFAULT_TIMEOUT_MS = 8000;

export interface LineReplyResult {
  success: boolean;
  status?: number;
  error?: string;
}

/**
 * LINE Messaging API の Reply API を呼び出してメッセージを返信する。
 *
 * Reply API は友だちからのメッセージ受信（またはWebhookイベント）を起点として
 * replyToken を用いて返信するため、月間無料メッセージ枠（200通）を消費しない（カウントフリー）。
 *
 * @param channelAccessToken - LINE Developersで発行した長期アクセストークン
 * @param replyToken - Webhookイベントに含まれる1回限りの返信用トークン
 * @param messages - 返信するメッセージ配列（最大5件まで）
 */
export async function sendLineReply(
  channelAccessToken: string,
  replyToken: string,
  messages: LineOutgoingMessage[],
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<LineReplyResult> {
  if (!channelAccessToken) {
    return { success: false, error: "LINE_CHANNEL_ACCESS_TOKEN is missing" };
  }

  if (!replyToken) {
    return { success: false, error: "replyToken is missing" };
  }

  if (!messages || messages.length === 0) {
    return { success: false, error: "No messages to send" };
  }

  // LINE APIの制限：1回の返信で最大5メッセージまで
  const sanitizedMessages = messages.slice(0, 5).map((msg) => {
    if (msg.type === "text") {
      return {
        ...msg,
        // LINEテキストメッセージ上限は5000文字
        text: msg.text.slice(0, 5000),
      };
    }
    return msg;
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(LINE_REPLY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: sanitizedMessages,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error("[LINE client] Reply failed:", {
        status: response.status,
        body: errorBody,
      });
      return {
        success: false,
        status: response.status,
        error: `LINE API error: ${response.status} ${errorBody}`,
      };
    }

    return { success: true, status: response.status };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const isAbort =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("aborted"));
    const errorMessage = isAbort
      ? `LINE API timeout after ${timeoutMs}ms`
      : err instanceof Error
      ? err.message
      : String(err);

    console.error("[LINE client] Exception during sendLineReply:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
