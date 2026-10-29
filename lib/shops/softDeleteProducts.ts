import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 商品の削除は、行を消さずに deleted_at を入れる（論理削除）。
 * 地図のキャッシュは「前回から変わった行」だけを取る差分更新なので、物理的に消すと削除を知る手段がない
 * （supabase/migrations/20261029100000_products_soft_delete_and_updated_at_triggers.sql）。
 *
 * 呼び出し側で `.eq("id", …)` / `.eq("vendor_id", …)` を足して対象を絞ること。
 * 戻り値に `.select()` を付けない（更新後の行は RLS で読めない行なので、エラーになる）。
 * 掃除は DB の purge_deleted_products が、論理削除から 7 日後に行う。
 */
export function softDeleteProducts(client: SupabaseClient) {
  return client.from("products").update({ deleted_at: new Date().toISOString() }).is("deleted_at", null);
}
