import type { createClient as createServerClient } from "@/utils/supabase/server";
import type { MarketArea } from "@/lib/market/marketAreas";

/**
 * 「テーブルが存在しない」エラーのコード。Postgres 自身は 42P01、PostgREST（Supabase の API）は、
 * スキーマのキャッシュに無いテーブルを読むと PGRST205 を返す（古い版は 42P01 のまま）。
 */
const UNDEFINED_TABLE_CODES: ReadonlySet<string> = new Set(["42P01", "PGRST205"]);

/**
 * 市ごとの丁目（market_areas）。マイグレーション前は空で返す。
 * 区画の丁目の選択肢は、区画が乗っている道の市の丁目から作る。
 */
export async function loadMarketAreas(supabase: ReturnType<typeof createServerClient>): Promise<MarketArea[]> {
  const { data, error } = await supabase
    .from("market_areas")
    .select("id, market_id, label, sort_order")
    .order("sort_order", { ascending: true });
  if (error?.code && UNDEFINED_TABLE_CODES.has(error.code)) return [];
  if (error) throw new Error("Failed to load market areas");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    marketId: row.market_id as string,
    label: row.label as string,
    sortOrder: Number(row.sort_order),
  }));
}
