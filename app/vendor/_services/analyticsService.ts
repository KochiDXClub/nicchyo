import { createClient } from "@/utils/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProductSale, VendorAnalytics, HourlyData, MarketTrend, SearchSourceRatio, SearchKeywordTrend, AiConsultAnalytics, HeartSummary } from "../_types";

// ─── ページビュー ───────────────────────────────────────────

export async function recordPageView(
  vendorId: string,
  source: "map" | "search" | "direct" = "direct"
): Promise<void> {
  const supabase = createClient();
  await supabase.from("shop_page_views").insert({ vendor_id: vendorId, source });
}

export async function fetchVendorAnalytics(vendorId: string): Promise<VendorAnalytics> {
  const supabase = createClient();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [thisWeekRes, lastWeekRes, allVendorsRes] = await Promise.all([
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
      .select("vendor_id")
      .gte("viewed_at", weekAgo),
  ]);

  const thisWeekViews = thisWeekRes.count ?? 0;
  const lastWeekViews = lastWeekRes.count ?? 0;

  // 注目度ランク算出
  const viewsByVendor = new Map<string, number>();
  for (const row of allVendorsRes.data ?? []) {
    viewsByVendor.set(row.vendor_id, (viewsByVendor.get(row.vendor_id) ?? 0) + 1);
  }
  const sorted = [...viewsByVendor.entries()].sort((a, b) => b[1] - a[1]);
  const rankIdx = sorted.findIndex(([id]) => id === vendorId);

  return {
    thisWeek: {
      views: thisWeekViews,
      clicks: Math.round(thisWeekViews * 0.28),
      searchImpressions: Math.round(thisWeekViews * 1.68),
    },
    lastWeek: {
      views: lastWeekViews,
      clicks: Math.round(lastWeekViews * 0.28),
      searchImpressions: Math.round(lastWeekViews * 1.68),
    },
    rank: rankIdx >= 0 ? rankIdx + 1 : sorted.length + 1,
    totalVendors: Math.max(viewsByVendor.size, 1),
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
    return {
      total: totalRes.count ?? 0,
      thisWeek: weekRes.count ?? 0,
    };
  } catch {
    return { total: 0, thisWeek: 0 };
  }
}

export async function fetchHourlyData(vendorId: string): Promise<HourlyData[]> {
  const supabase = createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("shop_page_views")
    .select("viewed_at")
    .eq("vendor_id", vendorId)
    .gte("viewed_at", weekAgo);

  const hourMap = new Map<number, number>();
  for (const row of data ?? []) {
    const h = new Date(row.viewed_at).getHours();
    hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
  }

  return Array.from({ length: 9 }, (_, i) => {
    const h = i + 6;
    return { hour: `${h}時`, views: hourMap.get(h) ?? 0 };
  });
}

// ─── 商品販売 ───────────────────────────────────────────────

export async function fetchTodayProductSales(vendorId: string): Promise<ProductSale[]> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabase
    .from("product_sales")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("sale_date", today)
    .order("quantity", { ascending: false });
  return data ?? [];
}

export async function fetchAllProductSales(vendorId: string): Promise<ProductSale[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("product_sales")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("quantity", { ascending: false });
  return data ?? [];
}

export async function saveTodayProductSales(
  vendorId: string,
  sales: Pick<ProductSale, "product_name" | "quantity">[]
): Promise<void> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  // 今日のレコードを削除して再挿入（upsert よりシンプル）
  await supabase
    .from("product_sales")
    .delete()
    .eq("vendor_id", vendorId)
    .eq("sale_date", today);

  if (sales.length === 0) return;

  const { error } = await supabase.from("product_sales").insert(
    sales.map((s) => ({
      vendor_id: vendorId,
      product_name: s.product_name,
      quantity: s.quantity,
      sale_date: today,
    }))
  );
  if (error) throw error;
}

export async function fetchSearchSourceRatio(vendorId: string): Promise<SearchSourceRatio> {
  const supabase = createClient();
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("shop_page_views")
    .select("source")
    .eq("vendor_id", vendorId)
    .gte("viewed_at", weekAgo);
  const counts: SearchSourceRatio = { preVisit: 0, onSite: 0, other: 0 };
  for (const row of data ?? []) {
    if (row.source === "search") counts.preVisit++;
    else if (row.source === "map") counts.onSite++;
    else counts.other++;
  }
  return counts;
}

export async function fetchMarketTrends(): Promise<MarketTrend[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("product_sales")
    .select("product_name, quantity, vendor_id");

  if (!data) return [];

  const map = new Map<string, { total: number; vendors: Set<string> }>();
  for (const row of data) {
    const entry = map.get(row.product_name) ?? { total: 0, vendors: new Set<string>() };
    entry.total += row.quantity;
    entry.vendors.add(row.vendor_id);
    map.set(row.product_name, entry);
  }

  return [...map.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([name, { total, vendors }], i) => ({
      rank: i + 1,
      product_name: name,
      total_quantity: total,
      vendor_count: vendors.size,
    }));
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
    .select("intent_category, keywords, location_type, is_recommendation")
    .eq("store_id", vendorId)
    .gte("consulted_at", weekAgo);

  if (!data || data.length === 0) {
    return { topics: [], keywords: [], recommendationCount: 0, locationRatio: { preVisit: 0, onSite: 0 }, totalCount: 0 };
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

  // 来訪前/現地
  const preVisit = data.filter((r) => r.location_type === "pre_visit").length;
  const onSite   = data.filter((r) => r.location_type === "on_site").length;

  return { topics, keywords, recommendationCount, locationRatio: { preVisit, onSite }, totalCount: data.length };
}
