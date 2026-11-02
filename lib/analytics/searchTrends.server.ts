import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 来訪者の検索語を数える（出店者の分析の「検索トレンド」・にちよさん相談で共通）。
 *
 * 生の検索語は来訪者が自由に打つ文章で、名前や電話番号が入ることもある。
 * そのため検索ログはサーバー側（service role）でだけ読み、呼び出し側へは
 * 「語と回数」の集計だけを返す（#922）。
 */

export type SearchKeywordCount = { keyword: string; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * 数えるために読む行数の上限（新しい順）。Supabase（PostgREST）が1回に返す既定の上限に合わせる。
 * 回数の大小を見るための見本なので、超えた分は古いほうから落ちる
 */
const ROW_LIMIT = 1000;
/** これより短い語は数えない（1文字は入力途中のものが多い） */
const MIN_KEYWORD_LENGTH = 2;
/**
 * これより少ない回数の語は出さない。検索の少ない週は、1人が1回だけ打った語（名前や電話番号など）が
 * そのまま上位に出てしまうため。わざと何度も打つ人までは防げないが、うっかりの露出は防げる
 */
const MIN_KEYWORD_COUNT = 2;

/**
 * 検索語を、回数の多い順に並べる。normalize で語をそろえてから、小文字にして数える。
 * normalize の結果が短すぎる語と、1回しか検索されていない語は出さない
 */
export function countSearchKeywords(
  keywords: string[],
  normalize: (raw: string) => string = (raw) => raw.trim()
): SearchKeywordCount[] {
  const counts = new Map<string, number>();
  for (const raw of keywords) {
    const keyword = normalize(raw ?? "").toLowerCase();
    if (keyword.length < MIN_KEYWORD_LENGTH) continue;
    counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([keyword, count]) => ({ keyword, count }))
    .filter(({ count }) => count >= MIN_KEYWORD_COUNT)
    .sort((a, b) => b.count - a.count);
}

/**
 * 直近 days 日の検索語を数える。admin は service role のクライアントを渡すこと
 * （product_search_logs は出店者・来訪者のクライアントでは読ませない）。
 * 読めなかったときは空を返す（数字が出ないほうが、画面や相談が止まるよりよい）
 */
export async function loadSearchKeywordCounts(
  admin: SupabaseClient,
  options: { days?: number; normalize?: (raw: string) => string } = {}
): Promise<SearchKeywordCount[]> {
  const since = new Date(Date.now() - (options.days ?? 7) * DAY_MS).toISOString();
  const { data, error } = await admin
    .from("product_search_logs")
    .select("keyword")
    .gte("searched_at", since)
    .order("searched_at", { ascending: false })
    .limit(ROW_LIMIT);
  if (error || !data) return [];
  return countSearchKeywords(
    (data as { keyword: string | null }[]).map((row) => row.keyword ?? ""),
    options.normalize
  );
}
