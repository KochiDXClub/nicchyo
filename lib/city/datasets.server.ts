import type { SupabaseClient } from "@supabase/supabase-js";
import { addDaysToDateString } from "@/lib/time/jstDate";

/**
 * 高知市に見せる集計データ。
 *
 * 取得はログイン中のユーザー自身のセッション（RLS あり）で行い、service role は使わない。
 * 来訪者（/analysis）が見られる範囲を超えて、高知市にだけ見せるデータは作らない。
 * ここに載せるのは集計済みの値だけで、個票（来訪者キー・検索語・AI の質問など）は載せない。
 */

export type CityDatasetKind = "visitors" | "market-days" | "categories";

export const CITY_DATASET_KINDS: readonly CityDatasetKind[] = ["visitors", "market-days", "categories"];

export type CityDataset = {
  columns: string[];
  rows: Record<string, unknown>[];
  /** 拡張子なしのファイル名のもと */
  name: string;
};

type Client = Pick<SupabaseClient, "from">;

/** 日別の Web 来訪者数（直近1年）。現地の来場者数ではなく Web の来訪者数 */
async function fetchVisitors(supabase: Client, todayIso: string): Promise<CityDataset> {
  const since = addDaysToDateString(todayIso, -365);
  const { data, error } = await supabase
    .from("web_visitor_stats")
    .select("visit_date, visitor_count")
    .gte("visit_date", since)
    .order("visit_date", { ascending: true });
  if (error) throw new Error("visitors");
  return {
    name: "web_visitors",
    columns: ["visit_date", "visitor_count"],
    rows: (data ?? []) as Record<string, unknown>[],
  };
}

/** 開催実績（日曜ごとの開催ステータス） */
async function fetchMarketDays(supabase: Client): Promise<CityDataset> {
  const { data, error } = await supabase
    .from("market_days")
    .select("market_date, status, note")
    .order("market_date", { ascending: true })
    .limit(2000);
  if (error) throw new Error("market-days");
  return {
    name: "market_days",
    columns: ["market_date", "status", "note"],
    rows: (data ?? []) as Record<string, unknown>[],
  };
}

/** カテゴリ別の出店数（掲載が許可された店舗） */
async function fetchCategories(supabase: Client): Promise<CityDataset> {
  const [categories, vendors] = await Promise.all([
    supabase.from("categories").select("id, name"),
    // 掲載を許可された店舗だけ。RLS は運営（全件）や店舗メンバー（自店）に広く見せるので、
    // 誰が開いても同じ数字になるよう、来訪者向け（/analysis）と同じ範囲をここで明示する
    supabase.from("vendors").select("category_id").eq("listing_status", "allowed"),
  ]);
  if (categories.error || vendors.error) throw new Error("categories");

  const nameById = new Map(
    ((categories.data ?? []) as { id: string; name: string | null }[]).map((c) => [
      c.id,
      c.name?.trim() || "未分類",
    ])
  );
  const counts = new Map<string, number>();
  for (const v of (vendors.data ?? []) as { category_id: string | null }[]) {
    const name = (v.category_id && nameById.get(v.category_id)) || "未分類";
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return {
    name: "vendors_by_category",
    columns: ["category", "count"],
    rows: Array.from(counts, ([category, count]) => ({ category, count })).sort(
      (a, b) => b.count - a.count
    ),
  };
}

export function isCityDatasetKind(value: unknown): value is CityDatasetKind {
  return typeof value === "string" && (CITY_DATASET_KINDS as readonly string[]).includes(value);
}

export async function fetchCityDataset(
  supabase: Client,
  kind: CityDatasetKind,
  todayIso: string
): Promise<CityDataset> {
  if (kind === "visitors") return fetchVisitors(supabase, todayIso);
  if (kind === "market-days") return fetchMarketDays(supabase);
  return fetchCategories(supabase);
}
