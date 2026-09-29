/**
 * LINE チャット専用のレートリミットと再送イベントの重複排除
 *
 * 悪意あるユーザーや自動スクリプトによる過剰なチャット送信、
 * OpenAI APIトークンの急激な枯渇を防ぐための2層防御：
 * 1. 1分あたりのバースト制限（60秒間に最大5回）
 * 2. 10分あたりの継続利用制限（10分間に最大25回）
 *
 * カウンターは lib/security/rateLimit の enforceRateLimit に乗せているため、
 * UPSTASH_REDIS_REST_URL/TOKEN が設定されていれば複数インスタンス間で共有される
 * （未設定時はインスタンス内 in-memory にフォールバック）。
 *
 * レート制限を超過した場合は、LINEのReply APIで温かい土佐弁の待機案内メッセージを返し、
 * OpenAIへの高負荷なAPI呼び出しは完全に遮断する。
 */
import { enforceRateLimit } from "../security/rateLimit";
import type { LineEventSource } from "./types";

const SHORT_WINDOW_MS = 60 * 1000; // 1分
const SHORT_WINDOW_LIMIT = 5; // 1分間に最大5回

const LONG_WINDOW_MS = 10 * 60 * 1000; // 10分
const LONG_WINDOW_LIMIT = 25; // 10分間に最大25回

/** LINE の再送は最初の配信から一定時間内に行われるため、この間だけ既処理として覚えておく */
const EVENT_DEDUPE_WINDOW_MS = 10 * 60 * 1000;

const SHORT_WINDOW_MESSAGE =
  "質問をたくさん届けてくれてありがとう！ちょっと頭が追いつかんき、1分ばあ待ってからまた聞いてねぇ🍵";
const LONG_WINDOW_MESSAGE =
  "今日はたくさん相談してくれて嬉しいちや！少し時間をおいてから、また気軽に話しかけてねぇ🍵";

export interface LineRateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  message?: string;
}

/**
 * イベント送信元からレートリミットのキーを作る。
 * userId が取れればユーザー単位、取れないグループ/トークルームは groupId/roomId 単位で数える。
 */
export function getLineRateLimitKey(source: LineEventSource | undefined): string {
  if (!source) return "unknown";
  if (source.userId) return `user:${source.userId}`;
  if (source.type === "group") return `group:${source.groupId}`;
  if (source.type === "room") return `room:${source.roomId}`;
  return "unknown";
}

function retryAfterFrom(response: Response): number | undefined {
  const value = Number(response.headers.get("Retry-After"));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * LINEの送信元ごとのチャット送信頻度を検査する。
 *
 * @param request - Webhook リクエスト（共有レートリミッターの呼び出しに渡す。キーには IP を含めない）
 * @param key - getLineRateLimitKey で作ったキー
 */
export async function checkLineUserRateLimit(
  request: Request,
  key: string
): Promise<LineRateLimitCheckResult> {
  const shortLimited = await enforceRateLimit(request, {
    bucket: "line-user-1m",
    limit: SHORT_WINDOW_LIMIT,
    windowMs: SHORT_WINDOW_MS,
    identity: key,
  });
  if (shortLimited) {
    return {
      allowed: false,
      retryAfterSeconds: retryAfterFrom(shortLimited),
      message: SHORT_WINDOW_MESSAGE,
    };
  }

  const longLimited = await enforceRateLimit(request, {
    bucket: "line-user-10m",
    limit: LONG_WINDOW_LIMIT,
    windowMs: LONG_WINDOW_MS,
    identity: key,
  });
  if (longLimited) {
    return {
      allowed: false,
      retryAfterSeconds: retryAfterFrom(longLimited),
      message: LONG_WINDOW_MESSAGE,
    };
  }

  return { allowed: true };
}

/**
 * 同じ webhookEventId をすでに受け取っていれば true を返す（初回は記録して false）。
 * LINE の再送（deliveryContext.isRedelivery）で同じメッセージに二重に OpenAI を呼んだり、
 * 二重に返信したりするのを防ぐ。
 */
export async function isDuplicateLineEvent(
  request: Request,
  webhookEventId: string | null | undefined
): Promise<boolean> {
  if (!webhookEventId) return false;
  const seen = await enforceRateLimit(request, {
    bucket: "line-event",
    limit: 1,
    windowMs: EVENT_DEDUPE_WINDOW_MS,
    identity: webhookEventId,
  });
  return seen !== null;
}
