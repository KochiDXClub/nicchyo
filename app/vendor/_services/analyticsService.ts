import { createClient } from "@/utils/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ShopViewSummary, SearchKeywordTrend, AiConsultAnalytics, HeartSummary } from "../_types";
import { hourlyCounts, sourceShares, type ViewRow } from "@/lib/vendor/analyticsSummary";

// ─── お店が見られた数 ────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** 時間帯・流入元の見本に読む行数の上限（PostgREST の 1 回の上限に合わせる。合計の回数は count で数える） */
const VIEW_ROWS_LIMIT = 1000;

/**
 * 自分のお店が見られた回数（過去7日・その前の7日）と、過去7日の時間帯・流入元。
 * 記録は POST /api/analytics/shop-view（お店の詳細が開かれたとき）。
 * shop_page_views は RLS で自分のお店の行だけが読める。
 */
export async function fetchShopViews(vendorId: string): Promise<ShopViewSummary> {
  const supabase = createClient();
  const now = Date.now();
  const weekAgo = new Date(now - WEEK_MS).toISOString();
  const twoWeeksAgo = new Date(now - 2 * WEEK_MS).toISOString();

  const [thisWeekCount, lastWeekCount, rows] = await Promise.all([
    supabase
      .from("shop_page_views")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .gte("viewed_at", weekAgo),
    supabase
      .from("shop_page_views")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId)
      .gte("viewed_at", twoWeeksAgo)
      .lt("viewed_at", weekAgo),
    supabase
      .from("shop_page_views")
      .select("viewed_at, source")
      .eq("vendor_id", vendorId)
      .gte("viewed_at", weekAgo)
      .order("viewed_at", { ascending: false })
      .limit(VIEW_ROWS_LIMIT),
  ]);
  if (thisWeekCount.error || lastWeekCount.error || rows.error) {
    throw thisWeekCount.error ?? lastWeekCount.error ?? rows.error;
  }

  const viewRows = (rows.data ?? []) as ViewRow[];
  return {
    thisWeek: thisWeekCount.count ?? 0,
    lastWeek: lastWeekCount.count ?? 0,
    hourly: hourlyCounts(viewRows),
    sources: sourceShares(viewRows),
    // 回数は exact で数えるが、時間帯・流入元は読めた行（上限あり）から数える。足りないときは画面に書く
    sampled: (thisWeekCount.count ?? 0) > viewRows.length,
  };
}

/**
 * 自分の投稿がもらったハート数の集計（累計・過去7日）。
 *
 * content_reactions の「自分の投稿への SELECT」ポリシー
 * （20260713 マイグレーション）により、認証済み出店者には
 * 自分の投稿分の行しか返らないので vendor_id フィルタは不要。
 * テーブルが生成済み Database 型に未登録のためクライアントはキャストする。
 */
export async function fetchVendorHeartSummary(): Promise<HeartSummary> {
  const supabase = createClient() as unknown as SupabaseClient;
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [totalRes, weekRes] = await Promise.all([
      supabase
        .from("content_reactions")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("content_reactions")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekAgo),
    ]);
    // Supabase はクエリ失敗時も基本的に throw せず { error } を返すため、
    // catch だけでは拾えない（例: RLSポリシー未適用で 0 が静かに返り続ける）。
    // デプロイ後の問題発見を容易にするため明示的にログする
    if (totalRes.error || weekRes.error) {
      console.error(
        "[fetchVendorHeartSummary] content_reactions query failed",
        totalRes.error ?? weekRes.error
      );
    }
    return {
      total: totalRes.count ?? 0,
      thisWeek: weekRes.count ?? 0,
    };
  } catch (error) {
    console.error("[fetchVendorHeartSummary] unexpected error", error);
    return { total: 0, thisWeek: 0 };
  }
}

/** 自分の商品の名前（「探されているもの」が自分の商品に当たるかを見るため） */
export async function fetchMyProductNames(vendorId: string): Promise<string[]> {
  const supabase = createClient();
  const { data } = await supabase.from("products").select("name").eq("vendor_id", vendorId);
  return (data ?? []).map((row) => row.name).filter((name): name is string => !!name);
}

// ─── 商品検索ログ ────────────────────────────────────────────

export async function recordProductSearch(keyword: string, resultCount: number): Promise<void> {
  const supabase = createClient();
  await supabase.from("product_search_logs").insert({ keyword, result_count: resultCount });
}

export async function fetchProductSearchTrends(
  myProductNames: string[]
): Promise<SearchKeywordTrend[]> {
  const supabase = createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("product_search_logs")
    .select("keyword")
    .gte("searched_at", weekAgo);

  if (!data) return [];

  const countMap = new Map<string, number>();
  for (const row of data) {
    const kw = row.keyword.trim().toLowerCase();
    if (kw.length < 2) continue;
    countMap.set(kw, (countMap.get(kw) ?? 0) + 1);
  }

  const lowerProductNames = myProductNames.map((n) => n.toLowerCase());

  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({
      keyword,
      count,
      matchesMyProducts: lowerProductNames.some(
        (p) => p.includes(keyword) || keyword.includes(p)
      ),
    }));
}

// ─── AI相談アナリティクス ────────────────────────────────────

export async function fetchAiConsultAnalytics(vendorId: string): Promise<AiConsultAnalytics> {
  const supabase = createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("ai_consult_logs")
    .select("intent_category, keywords, is_recommendation")
    .eq("store_id", vendorId)
    .gte("consulted_at", weekAgo);

  if (!data || data.length === 0) {
    return { topics: [], keywords: [], recommendationCount: 0, totalCount: 0 };
  }

  // トピック集計
  const topicMap = new Map<string, number>();
  for (const row of data) {
    const cat = row.intent_category ?? "その他";
    topicMap.set(cat, (topicMap.get(cat) ?? 0) + 1);
  }
  const topics = [...topicMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }));

  // キーワード集計
  const kwMap = new Map<string, number>();
  for (const row of data) {
    for (const kw of (row.keywords as string[]) ?? []) {
      if (kw.length >= 2) kwMap.set(kw, (kwMap.get(kw) ?? 0) + 1);
    }
  }
  const keywords = [...kwMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([keyword, count]) => ({ keyword, count }));

  // 紹介回数
  const recommendationCount = data.filter((r) => r.is_recommendation).length;

  return { topics, keywords, recommendationCount, totalCount: data.length };
}
