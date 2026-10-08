import type { SupabaseClient } from "@supabase/supabase-js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * 自分のお店の詳細が開かれた回数（直近7日と、その前の7日）。
 * 出店者の分析ページと、出店者の相談（にちよさん）が、同じ数を見せるための1か所。
 * shop_page_views は RLS で自分のお店の行だけが読める。読めなかったときは throw する。
 */
export async function countShopViews(
  supabase: SupabaseClient,
  vendorId: string,
  now: number = Date.now()
): Promise<{ thisWeek: number; lastWeek: number }> {
  const weekAgo = new Date(now - WEEK_MS).toISOString();
  const twoWeeksAgo = new Date(now - 2 * WEEK_MS).toISOString();

  const [thisWeek, lastWeek] = await Promise.all([
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
  ]);
  if (thisWeek.error || lastWeek.error) throw thisWeek.error ?? lastWeek.error;
  return { thisWeek: thisWeek.count ?? 0, lastWeek: lastWeek.count ?? 0 };
}
