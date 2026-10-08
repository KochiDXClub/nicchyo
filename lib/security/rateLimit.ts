import { NextResponse } from "next/server";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  bucket: string;
  limit: number;
  windowMs: number;
  /** IPと組み合わせてキーを分ける。同一IPの別ユーザーを区別したいときに使う */
  keySuffix?: string | null;
  /**
   * IPの代わりにこの値でキーを作る（ログイン済みユーザーIDなど）。
   * IPを含めないので、回線を変えてもカウントが持ち越される。
   * 指定した場合 keySuffix は無視する。
   */
  identity?: string | null;
  message?: string;
};

// ── in-memory fallback（単一プロセス内のみ有効） ───────────────────────────
// UPSTASH_REDIS_REST_URL が未設定の場合に使用する。
// Vercel 等の複数インスタンス環境では各インスタンスが独立したカウンターを持つため、
// 本番で確実なレート制限を行うには Upstash Redis 環境変数の設定が必要。
const RATE_LIMIT_STORE = new Map<string, RateLimitEntry>();
const MAX_BUCKETS = 20000;

function cleanupIfNeeded() {
  if (RATE_LIMIT_STORE.size <= MAX_BUCKETS) return;
  const oldest = Array.from(RATE_LIMIT_STORE.entries())
    .sort((a, b) => a[1].resetAt - b[1].resetAt)
    .slice(0, 3000);
  oldest.forEach(([key]) => RATE_LIMIT_STORE.delete(key));
}

function inMemoryRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  message: string
): NextResponse | null {
  const now = Date.now();
  const current = RATE_LIMIT_STORE.get(key);

  if (!current || now > current.resetAt) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + windowMs });
    cleanupIfNeeded();
    return null;
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too Many Requests", message },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  current.count += 1;
  return null;
}

// ── Upstash Redis ──────────────────────────────────────────────────────────
// UPSTASH_REDIS_REST_URL と UPSTASH_REDIS_REST_TOKEN が設定されている場合に使用する。
// 複数インスタンス間で共有されるため、水平スケール環境でも正確なレート制限が機能する。
export const isUpstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

// 本番（Vercel の VERCEL_ENV=production）はマルチインスタンスが前提のため、
// in-memory フォールバックだとインスタンスごとに別カウンターになり実効性がない（Issue #352）。
// ここでリクエストを落とすとUpstash未設定の間サイト全体が止まってしまうため、
// 「気づけるように大声で警告する」までに留め、実際に落とす/失敗にするのは
// /api/health（ヘルスチェック監視で気づける）側に任せる。
// モジュール評価時（サーバーレス関数のコールドスタート毎）に1回走る
if (process.env.VERCEL_ENV === "production" && !isUpstashConfigured) {
  console.error(
    "[rateLimit] UPSTASH_REDIS_REST_URL/TOKEN が本番で未設定です。" +
      "レート制限がインスタンス内 in-memory にフォールバックし、" +
      "複数インスタンス構成では実効性がありません。Vercel の環境変数を確認してください。"
  );
}

let upstashRatelimit:
  | ((key: string, limit: number, windowMs: number) => Promise<{ success: boolean; reset: number }>)
  | null = null;

if (isUpstashConfigured) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis") as typeof import("@upstash/redis");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Ratelimit } = require("@upstash/ratelimit") as typeof import("@upstash/ratelimit");

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  // windowMs ごとに bucket キャッシュを作る（異なる windowMs は別インスタンス）
  const limiterCache = new Map<string, InstanceType<typeof Ratelimit>>();

  upstashRatelimit = async (key, limit, windowMs) => {
    const cacheKey = `${limit}:${windowMs}`;
    if (!limiterCache.has(cacheKey)) {
      limiterCache.set(
        cacheKey,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
          prefix: "nicchyo:rl",
        })
      );
    }
    const limiter = limiterCache.get(cacheKey)!;
    const result = await limiter.limit(key);
    return { success: result.success, reset: result.reset };
  };
}

// ── 公開 API ───────────────────────────────────────────────────────────────


/**
 * x-real-ip / x-forwarded-for はこのアプリの前段（Vercel のエッジ）が
 * 上書きして設定する前提で信頼している。クライアントが直接これらの
 * ヘッダーを送っても、Vercel 環境ではエッジで実際の接続元IPに書き換わる。
 * この前提が崩れる構成（別プロキシ経由・セルフホスト等）に変える場合は、
 * クライアントがヘッダーを偽装してバケットを毎回変え、レート制限を
 * すり抜けられてしまうため、ここも見直すこと
 */
export function getClientIp(request: Request): string {
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (!forwardedFor) return "unknown";

  return forwardedFor.split(",")[0]?.trim() || "unknown";
}

export async function enforceRateLimit(
  request: Request,
  { bucket, limit, windowMs, keySuffix, identity, message }: RateLimitOptions
): Promise<NextResponse | null> {
  // identity が指定されたときは IP をキーに含めない。
  // keySuffix は IP と併用する（同一IPの別ユーザーを区別するが、IPを変えると別枠になる）ため、
  // 「ログイン済みユーザー1人あたり」を数えたい場合は identity を使う
  const key = identity
    ? [bucket, "id", identity].join(":")
    : [bucket, getClientIp(request), keySuffix ?? ""].join(":");
  const defaultMessage = message ?? "リクエストが多すぎます。しばらくしてからお試しください。";

  if (upstashRatelimit) {
    const { success, reset } = await upstashRatelimit(key, limit, windowMs);
    if (success) return null;
    const retryAfterSeconds = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too Many Requests", message: defaultMessage },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  return inMemoryRateLimit(key, limit, windowMs, defaultMessage);
}
