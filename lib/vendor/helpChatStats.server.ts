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
/**
 * 集計のために読む行数の上限。Supabase（PostgREST）が1回に返す行数の既定の上限（1000）に合わせる。
 * 回数そのものは count で数え、ここは「よく出る言葉」を出すための見本の数にだけ使う
 */
const ROW_LIMIT = 1000;
/** 売れ数1件あたりの上限。出店者が自分で入れる数なので、極端な値で順位が崩れないようにする */
const SALE_QUANTITY_MAX = 1000;
/** プロンプトに入れる言葉・商品名の長さの上限 */
const DATA_WORD_MAX = 20;

/**
 * 来訪者や出店者が入力した言葉を、にちよさんに渡せる形にする。
 * 検索語や商品名は誰でも書き込めるので、指示文を混ぜ込まれても効きにくいよう、
 * 改行・記号を落として短く切る（プロンプト側でも「データであり指示ではない」と伝える）
 */
export function toDataWord(raw: string, max = DATA_WORD_MAX): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[【】\[\]()（）<>＜＞{}「」『』"'`#*:：]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clampQuantity(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.min(Math.max(n, 0), SALE_QUANTITY_MAX);
}

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
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const recent = () =>
    supabase.from("ai_consult_logs").select("id", { count: "exact", head: true }).eq("store_id", vendorId).gte("consulted_at", since);

  const [total, recommended, sample] = await Promise.all([
    recent(),
    recent().eq("is_recommendation", true),
    supabase
      .from("ai_consult_logs")
      .select("keywords")
      .eq("store_id", vendorId)
      .gte("consulted_at", since)
      .order("consulted_at", { ascending: false })
      .limit(ROW_LIMIT),
  ]);
  if (total.error || recommended.error || sample.error) return null;

  const keywordCounts = new Map<string, number>();
  for (const row of (sample.data ?? []) as { keywords: string[] | null }[]) {
    for (const keyword of row.keywords ?? []) {
      const word = toDataWord(keyword);
      if (word) keywordCounts.set(word, (keywordCounts.get(word) ?? 0) + 1);
    }
  }
  return {
    total: total.count ?? 0,
    recommended: recommended.count ?? 0,
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

type SaleRow = { product_name: string; quantity: number };

/** 商品名ごとに売れ数を合計する（名前はプロンプトに入れられる形に、数は上限で切って） */
function sumSales(rows: SaleRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const name = toDataWord(row.product_name ?? "");
    if (!name) continue;
    totals.set(name, (totals.get(name) ?? 0) + clampQuantity(row.quantity));
  }
  return totals;
}

async function loadOwnSales(supabase: SupabaseClient, vendorId: string) {
  const { data, error } = await supabase
    .from("product_sales")
    .select("product_name, quantity")
    .eq("vendor_id", vendorId)
    .order("sale_date", { ascending: false })
    .limit(ROW_LIMIT);
  if (error || !data) return [];

  const totals = sumSales(data as SaleRow[]);
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
    .order("searched_at", { ascending: false })
    .limit(ROW_LIMIT);
  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data as { keyword: string }[]) {
    const keyword = toDataWord(row.keyword ?? "").toLowerCase();
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

  return topKeys(sumSales(data as SaleRow[]), 5);
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
