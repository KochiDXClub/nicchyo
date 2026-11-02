import { isAnalyticsOptedOut } from "@/lib/analytics/consentClient";
import { MAX_SHOP_ID } from "@/lib/shops/route";

/**
 * 来訪者の検索キーワードを数える（出店者の「お店の分析」の検索トレンドの元になる）。
 * 書き込みは /api/analytics/search-log がサーバー側で行う（ブラウザから product_search_logs へ直接 INSERT しない）。
 */

/** これより短いキーワードは記録しない（1文字は打ちかけがほとんどで、トレンドの集計でも捨てている） */
export const MIN_SEARCH_KEYWORD_LENGTH = 2;
/** これより長いキーワードは記録しない（商品名の検索には十分で、DB 肥大と貼り付けの混入を防ぐ） */
export const MAX_SEARCH_KEYWORD_LENGTH = 100;
/** 件数として受け付ける上限。検索結果は店舗の数を超えないので、超える値は壊れたクライアントか偽装 */
const MAX_RESULT_COUNT = MAX_SHOP_ID;

export type SearchLog = { keyword: string; resultCount: number };

/** API が受け取った body を検証する。不正なら null */
export function parseSearchLog(body: unknown): SearchLog | null {
  if (!body || typeof body !== "object") return null;
  const { keyword, resultCount } = body as { keyword?: unknown; resultCount?: unknown };
  if (typeof keyword !== "string") return null;
  // 全角英数・半角カナなどの表記ゆれを揃え、トレンドの集計で同じ語を1つに数える
  const trimmed = keyword.normalize("NFKC").trim();
  if (trimmed.length < MIN_SEARCH_KEYWORD_LENGTH || trimmed.length > MAX_SEARCH_KEYWORD_LENGTH) return null;
  // 改行・NUL などの制御文字は検索語ではない（NUL は Postgres が拒否して 500 になる）
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  if (
    typeof resultCount !== "number" ||
    !Number.isInteger(resultCount) ||
    resultCount < 0 ||
    resultCount > MAX_RESULT_COUNT
  ) {
    return null;
  }
  return { keyword: trimmed, resultCount };
}

/** 検索キーワードを記録する。結果は待たず、失敗は無視する */
export function recordSearch(keyword: string, resultCount: number): void {
  if (typeof window === "undefined" || isAnalyticsOptedOut()) return;
  const length = keyword.trim().length;
  // サーバーが受け付けない長さは送らない（貼り付けた長文などで無駄な 400 を出さない）
  if (length < MIN_SEARCH_KEYWORD_LENGTH || length > MAX_SEARCH_KEYWORD_LENGTH) return;
  void fetch("/api/analytics/search-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keyword, resultCount }),
    keepalive: true,
  }).catch(() => {});
}
