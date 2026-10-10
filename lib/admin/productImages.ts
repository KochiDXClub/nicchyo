/**
 * 商品の写真（運営の代理登録）で、API ルートが共有する決まりごと。
 *
 * 商品の写真は products テーブルの「同じ名前の商品」の行（image_url）に置く。
 * 出店者本人の保存（app/vendor/_services/askService.ts）と同じ置き方なので、
 * 名前の付け方（product-<商品id>.*）を変えない。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGE_BUCKET = "vendor-images";

export const productImagePath = (vendorId: string, productId: string) => `${vendorId}/product-${productId}.webp`;

/**
 * 商品の写真ファイル（product-<商品id>.*）を Storage から消す。keepPath は残すファイル。
 * 形式が変わったときの前回分を掃除するのにも使う。消せなくても本処理は成功させたいので、失敗は投げない
 */
export async function removeProductImageFiles(
  client: SupabaseClient,
  vendorId: string,
  productId: string,
  keepPath?: string,
): Promise<void> {
  try {
    const storage = client.storage.from(PRODUCT_IMAGE_BUCKET);
    const { data: files } = await storage.list(vendorId);
    const stale = (files ?? [])
      .filter((file) => file.name.startsWith(`product-${productId}.`))
      .map((file) => `${vendorId}/${file.name}`)
      .filter((path) => path !== keepPath);
    if (stale.length > 0) await storage.remove(stale);
  } catch (error) {
    console.warn("[admin/productImages] 古い商品写真の掃除に失敗しました:", error);
  }
}

/**
 * 主な商品の一覧から外した商品の行と写真を消す（出店者本人の保存 saveProducts と同じ決まり）。
 *   - 画面に出ていた商品（主な商品が空だったときは products の商品）のうち、新しい一覧に無いものだけ
 *   - 看板商品は別の質問で決めたものなので残す
 *   - 画面に出ていなかった行には触らない
 * 一覧の保存は済んでいるので、ここでの失敗は投げない（残った行は、次に商品を保存したときに片付く）
 */
export async function purgeRemovedProducts(
  client: SupabaseClient,
  vendorId: string,
  previousNames: string[],
  nextNames: string[],
): Promise<void> {
  try {
    const [rowsResult, vendorResult] = await Promise.all([
      client.from("products").select("id, name").eq("vendor_id", vendorId),
      client.from("vendors").select("signature_product_name").eq("id", vendorId).maybeSingle(),
    ]);
    if (rowsResult.error) throw rowsResult.error;
    const rows = (rowsResult.data ?? []) as { id: string; name: string }[];
    const signatureName = (vendorResult.data?.signature_product_name as string | null | undefined)?.trim();
    const shown = new Set(previousNames.length > 0 ? previousNames : rows.map((row) => row.name));
    const kept = new Set(nextNames);

    for (const row of rows) {
      if (!shown.has(row.name) || kept.has(row.name) || row.name === signatureName) continue;
      const { error } = await client.from("products").delete().eq("id", row.id).eq("vendor_id", vendorId);
      if (error) throw error;
      await removeProductImageFiles(client, vendorId, row.id);
    }
  } catch (error) {
    console.warn("[admin/productImages] 外した商品の掃除に失敗しました:", error);
  }
}
