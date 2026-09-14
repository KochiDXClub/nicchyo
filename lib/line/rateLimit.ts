/**
 * LINE チャット専用のレートリミット機構
 *
 * 悪意あるユーザーや自動スクリプトによる過剰なチャット送信、
 * OpenAI APIトークンの急激な枯渇を防ぐための2層防御：
 * 1. 1分あたりのバースト制限（例: 60秒間に最大5回）
 * 2. 10分あたりの継続利用制限（例: 10分間に最大25回）
 *
 * レート制限を超過した場合は、LINEのReply APIで温かい土佐弁の待機案内メッセージを返し、
 * OpenAIへの高負荷なAPI呼び出しは完全に遮断する。
 */

type UserRateEntry = {
  timestamps: number[];
};

const USER_RATE_STORE = new Map<string, UserRateEntry>();
const MAX_STORED_USERS = 5000;

// 制限パラメータ
const SHORT_WINDOW_MS = 60 * 1000; // 1分
const SHORT_WINDOW_LIMIT = 5; // 1分間に最大5回

const LONG_WINDOW_MS = 10 * 60 * 1000; // 10分
const LONG_WINDOW_LIMIT = 25; // 10分間に最大25回

export interface LineRateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  message?: string;
}

/** 古くなったエントリを掃除してメモリリークを防ぐ */
function cleanupOldEntries(now: number) {
  if (USER_RATE_STORE.size <= MAX_STORED_USERS) return;

  const threshold = now - LONG_WINDOW_MS;
  for (const [userId, entry] of USER_RATE_STORE.entries()) {
    const valid = entry.timestamps.filter((ts) => ts > threshold);
    if (valid.length === 0) {
      USER_RATE_STORE.delete(userId);
    } else {
      entry.timestamps = valid;
    }
  }
}

/**
 * LINEユーザーごとのチャット送信頻度を検査する。
 *
 * @param userId - LINEのユーザー識別子（Uから始まる33文字の文字列）
 */
export function checkLineUserRateLimit(
  userId: string | null | undefined,
  now: number = Date.now()
): LineRateLimitCheckResult {
  if (!userId) {
    // ユーザーIDが取れない場合は安全のため通過させる（署名検証済み前提）
    return { allowed: true };
  }

  cleanupOldEntries(now);

  const entry = USER_RATE_STORE.get(userId) ?? { timestamps: [] };

  // 10分以前の記録を除外
  const recentTimestamps = entry.timestamps.filter(
    (ts) => ts > now - LONG_WINDOW_MS
  );

  // 1. 短期（1分）チェック
  const shortWindowCount = recentTimestamps.filter(
    (ts) => ts > now - SHORT_WINDOW_MS
  ).length;

  if (shortWindowCount >= SHORT_WINDOW_LIMIT) {
    const oldestInShort = recentTimestamps
      .filter((ts) => ts > now - SHORT_WINDOW_MS)
      .sort((a, b) => a - b)[0];
    const retryAfter = Math.max(
      1,
      Math.ceil((oldestInShort + SHORT_WINDOW_MS - now) / 1000)
    );

    return {
      allowed: false,
      retryAfterSeconds: retryAfter,
      message:
        "質問をたくさん届けてくれてありがとう！ちょっと頭が追いつかんき、1分ばあ待ってからまた聞いてねぇ🍵",
    };
  }

  // 2. 中期（10分）チェック
  if (recentTimestamps.length >= LONG_WINDOW_LIMIT) {
    const oldestInLong = recentTimestamps.sort((a, b) => a - b)[0];
    const retryAfter = Math.max(
      1,
      Math.ceil((oldestInLong + LONG_WINDOW_MS - now) / 1000)
    );

    return {
      allowed: false,
      retryAfterSeconds: retryAfter,
      message:
        "今日はたくさん相談してくれて嬉しいちや！少し時間をおいてから、また気軽に話しかけてねぇ🍵",
    };
  }

  // 記録を更新
  recentTimestamps.push(now);
  USER_RATE_STORE.set(userId, { timestamps: recentTimestamps });

  return { allowed: true };
}

/** テスト用リセット関数 */
export function _resetLineRateLimitStore() {
  USER_RATE_STORE.clear();
}
