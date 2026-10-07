import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/supabase/fetchAllRows";
import type { Database } from "@/types/database.types";

/**
 * 店舗の基本データ（products / market_locations / location_assignments）の全件取得。
 * 地図（shopDb.ts）と AI 埋め込み同期（sync-embeddings）が同じ取り方をするため共通化している。
 * どちらも PostgREST の max_rows (1000) で黙って切り詰められないよう range ページングで読み切る。
 */

export function fetchProductRows<T>(supabase: SupabaseClient<Database>) {
  return fetchAllRows<T>(
    (from, to) =>
      supabase
        .from("products")
        .select("vendor_id, name")
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    { label: "products" }
  );
}

export function fetchLocationRows<T>(supabase: SupabaseClient<Database>) {
  return fetchAllRows<T>(
    (from, to) =>
      supabase
        .from("market_locations")
        .select("id, store_number, latitude, longitude, district")
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    { label: "market_locations" }
  );
}

/**
 * 履歴が週ごとに溜まるテーブル。新しい週から読めば、万一打ち切られても落ちるのは古い行になる。
 * 利用側が「vendor ごとに最新の market_date を JS で選ぶ」設計のため、全行を返す。
 */
export function fetchAssignmentRows<T>(supabase: SupabaseClient<Database>) {
  return fetchAllRows<T>(
    (from, to) =>
      supabase
        .from("location_assignments")
        .select("vendor_id, location_id, market_date")
        .order("market_date", { ascending: false })
        .order("id", { ascending: true })
        .range(from, to) as unknown as PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
    { label: "location_assignments" }
  );
}
