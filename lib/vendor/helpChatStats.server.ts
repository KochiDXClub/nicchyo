/**
 * 出店者の相談（/api/vendor/help-chat）で、にちよさんに渡す数字を集める。
 *
 * どれも出店者本人の cookie のクライアントで読める範囲だけを使う（service role は使わない）。
 * - このお店の数字: RLS で自分の行だけが読める表（ai_consult_logs・content_reactions・product_sales）
 * - 日曜市全体の数字: 出店者の分析画面と同じく、ログインしていれば読める表の合計だけ
 *   （ほかのお店の個別の数字は作らない）
 *
 * 集計に失敗しても相談自体はできるよう、取れなかった項目は null / 空にする。
 *
 * まだ渡さないもの:
 * - お店の閲覧数（shop_page_views）… 今は書き込む処理が無く、0 と答えてしまうため
 * - お気に入り数 … お気に入りは来訪者の端末（localStorage）にしか無く、数えられないため
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchMonthlyVisitors, fetchWeeklyVisitors } from "@/lib/analytics/visitorStats.server";

const DAY_MS = 24 * 60 * 60 * 1000;
/** 合計を出すために読む行数の上限（出店者1人の相談ごとに読むので、重くしない） */
const ROW_LIMIT = 5000;

export type VendorHelpShopStats = {
  /** 直近7日に、来訪者の AI 相談でこのお店が話題になった回数と、そのうちおすすめされた回数 */
  aiMentions: { total: number; recommended: number; topKeywords: string[] } | null;
  /** このお店の投稿へのハート */
  hearts: { thisWeek: number; total: number } | null;
  /** 出店者が自分で記録した売れ数（多い順） */
  topSales: { name: string; quantity: number }[];
};

export type VendorHelpMarketStats = {
  /** nicchyo の来訪者数（今週・今月） */
  weeklyVisitors: number | null;
  monthlyVisitors: number | null;
  /** 直近7日に、来訪者がよく検索した言葉 */
  topSearchKeywords: string[];
  /** 出店者の記録から見た、日曜市でよく売れている商品 */
  topSellingProducts: string[];
};

function topKeys(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key);
}

async function loadAiMentions(supabase: SupabaseClient, vendorId: string) {
  const { data, error } = await supabase
    .from("ai_consult_logs")
    .select("keywords, is_recommendation")
    .eq("store_id", vendorId)
    .gte("consulted_at", new Date(Date.now() - 7 * DAY_MS).toISOString())
    .limit(ROW_LIMIT);
  if (error || !data) return null;

  const rows = data as { keywords: string[] | null; is_recommendation: boolean | null }[];
  const keywordCounts = new Map<string, number>();
  for (const row of rows) {
    for (const keyword of row.keywords ?? []) {
      const trimmed = keyword.trim();
      if (trimmed) keywordCounts.set(trimmed, (keywordCounts.get(trimmed) ?? 0) + 1);
    }
  }
  return {
    total: rows.length,
    recommended: rows.filter((row) => row.is_recommendation).length,
    topKeywords: topKeys(keywordCounts, 5),
  };
}

async function loadHearts(supabase: SupabaseClient) {
  // content_reactions は RLS で「自分の投稿へのハート」だけが読める（出店者の分析画面と同じ）
  const [total, week] = await Promise.all([
    supabase.from("content_reactions").select("id", { count: "exact", head: true }),
    supabase
      .from("content_reactions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date(Date.now() - 7 * DAY_MS).toISOString()),
  ]);
  if (total.error || week.error) return null;
  return { total: total.count ?? 0, thisWeek: week.count ?? 0 };
}

async function loadOwnSales(supabase: SupabaseClient, vendorId: string) {
  const { data, error } = await supabase
    .from("product_sales")
    .select("product_name, quantity")
    .eq("vendor_id", vendorId)
    .limit(ROW_LIMIT);
  if (error || !data) return [];

  const totals = new Map<string, number>();
  for (const row of data as { product_name: string; quantity: number }[]) {
    totals.set(row.product_name, (totals.get(row.product_name) ?? 0) + row.quantity);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, quantity]) => ({ name, quantity }));
}

async function loadSearchKeywords(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("product_search_logs")
    .select("keyword")
    .gte("searched_at", new Date(Date.now() - 7 * DAY_MS).toISOString())
    .limit(ROW_LIMIT);
  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data as { keyword: string }[]) {
    const keyword = row.keyword.trim().toLowerCase();
    // 1文字の検索は、入力途中のものが多いので数えない（出店者の分析画面と同じ）
    if (keyword.length < 2) continue;
    counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
  }
  return topKeys(counts, 5);
}

async function loadMarketSales(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("product_sales")
    .select("product_name, quantity")
    .order("sale_date", { ascending: false })
    .limit(ROW_LIMIT);
  if (error || !data) return [];

  const totals = new Map<string, number>();
  for (const row of data as { product_name: string; quantity: number }[]) {
    totals.set(row.product_name, (totals.get(row.product_name) ?? 0) + row.quantity);
  }
  return topKeys(totals, 5);
}

/** 失敗しても相談を止めない */
async function orFallback<T>(promise: Promise<T>, fallback: T): Promise<T> {
  try {
    return await promise;
  } catch {
    return fallback;
  }
}

export async function loadVendorHelpShopStats(
  supabase: SupabaseClient,
  vendorId: string
): Promise<VendorHelpShopStats> {
  const [aiMentions, hearts, topSales] = await Promise.all([
    orFallback(loadAiMentions(supabase, vendorId), null),
    orFallback(loadHearts(supabase), null),
    orFallback(loadOwnSales(supabase, vendorId), []),
  ]);
  return { aiMentions, hearts, topSales };
}

export async function loadVendorHelpMarketStats(supabase: SupabaseClient): Promise<VendorHelpMarketStats> {
  const [weeklyVisitors, monthlyVisitors, topSearchKeywords, topSellingProducts] = await Promise.all([
    orFallback(fetchWeeklyVisitors(), null),
    orFallback(fetchMonthlyVisitors(), null),
    orFallback(loadSearchKeywords(supabase), []),
    orFallback(loadMarketSales(supabase), []),
  ]);
  return { weeklyVisitors, monthlyVisitors, topSearchKeywords, topSellingProducts };
}
