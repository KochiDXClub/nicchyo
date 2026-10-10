/**
 * 商品の写真（運営の代理登録）で、API ルートが共有する決まりごと。
 *
 * 商品の写真は products テーブルの「同じ名前の商品」の行（image_url）に置く。
 * 出店者本人の保存と同じ置き方（vendor-images/<店舗id>/product-<商品id>.*）なので、名前の付け方を変えない。
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGE_BUCKET = "vendor-images";

export const productImagePath = (vendorId: string, productId: string) => `${vendorId}/product-${productId}.webp`;

/** Supabase の Storage の公開 URL か（next.config.js の remotePatterns と同じ *.supabase.co の https） */
export function isSupabaseStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".supabase.co") && parsed.pathname.startsWith("/storage/");
  } catch {
    return false;
  }
}

/**
 * 公開 URL から、自店舗のフォルダ直下の商品写真のパス（<店舗id>/product-<id>.<拡張子>）を取り出す。形が違えば null。
 * image_url は店舗側の権限でも書き換えられる列なので、URL を信用して消さない。
 * 自店舗のフォルダ・ファイル名の形に合うものだけを、消す対象にする（他店舗のファイルを消せる穴にしない）
 */
export function ownProductImagePath(url: string | null | undefined, vendorId: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${PRODUCT_IMAGE_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at < 0) return null;
  let path: string;
  try {
    path = decodeURIComponent(url.slice(at + marker.length).split(/[?#]/)[0]);
  } catch {
    return null;
  }
  const parts = path.split("/");
  return parts.length === 2 && parts[0] === vendorId && /^product-[0-9a-f-]+\.[a-z0-9]+$/i.test(parts[1]) ? path : null;
}

/**
 * 商品の写真ファイルを Storage から消す。
 *   - product-<商品id>.*（形式が変わったときの前回分も含む）
 *   - imageUrl が指している自店舗の写真（出店者側の保存で商品の行の id が変わり、URL だけ前の id を指すことがある）
 * keepPath は残すファイル。消せなくても本処理は成功させたいので、失敗は投げず、消し切れたかを返す
 */
export async function removeProductImageFiles(
  client: SupabaseClient,
  vendorId: string,
  productId: string,
  options: { keepPath?: string; imageUrl?: string | null } = {},
): Promise<boolean> {
  try {
    const storage = client.storage.from(PRODUCT_IMAGE_BUCKET);
    // 既定の 100 件までだと、近況の写真などが多い店舗で product-* が一覧に出ない。名前で絞って多めに取る
    const { data: files } = await storage.list(vendorId, { limit: 1000, search: `product-${productId}.` });
    const targets = new Set(
      (files ?? [])
        .filter((file) => file.name.startsWith(`product-${productId}.`))
        .map((file) => `${vendorId}/${file.name}`),
    );
    const linked = ownProductImagePath(options.imageUrl, vendorId);
    if (linked) targets.add(linked);
    if (options.keepPath) targets.delete(options.keepPath);
    if (targets.size === 0) return true;
    const { error } = await storage.remove([...targets]);
    if (error) throw error;
    return true;
  } catch (error) {
    console.warn("[admin/productImages] 商品写真の掃除に失敗しました:", error);
    return false;
  }
}

/**
 * 主な商品の一覧から外した商品の写真を外し、何も持たない行は消す。
 *   - 画面に出ていた商品（保存前の主な商品）のうち、新しい一覧に無いものだけ。
 *     現場登録の画面は主な商品しか出さないので、それが空だったなら、何も出ていなかった = 何も触らない
 *     （出店者側の保存は主な商品が空でも products に商品の行を持つことがあり、その行は説明や旬を持つ）
 *   - 看板商品は別の質問で決めたものなので残す
 *   - 説明（description）や旬（product_seasons）を持つ行は、出店者がマイショップで登録したもの。
 *     行を消すと一緒に消える（on delete cascade）ので、行は残して写真だけ外す
 * 一覧の保存は済んでいるので、ここでの失敗は投げない（残った行は、次に商品を保存したときに片付く）
 */
export async function purgeRemovedProducts(
  client: SupabaseClient,
  vendorId: string,
  previousNames: string[],
  nextNames: string[],
): Promise<void> {
  if (previousNames.length === 0) return;
  try {
    const [rowsResult, vendorResult] = await Promise.all([
      client.from("products").select("id, name, image_url, description").eq("vendor_id", vendorId),
      client.from("vendors").select("signature_product_name").eq("id", vendorId).maybeSingle(),
    ]);
    if (rowsResult.error) throw rowsResult.error;
    const rows = (rowsResult.data ?? []) as {
      id: string;
      name: string;
      image_url: string | null;
      description: string | null;
    }[];
    const signatureName = (vendorResult.data?.signature_product_name as string | null | undefined)?.trim();
    const shown = new Set(previousNames);
    const kept = new Set(nextNames);
    const removed = rows.filter((row) => shown.has(row.name) && !kept.has(row.name) && row.name !== signatureName);
    if (removed.length === 0) return;

    const seasonResult = await client
      .from("product_seasons")
      .select("product_id")
      .in(
        "product_id",
        removed.map((row) => row.id),
      );
    if (seasonResult.error) throw seasonResult.error;
    const withSeason = new Set(((seasonResult.data ?? []) as { product_id: string }[]).map((row) => row.product_id));

    for (const row of removed) {
      if (row.description?.trim() || withSeason.has(row.id)) {
        if (row.image_url) {
          const { error } = await client
            .from("products")
            .update({ image_url: null, updated_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("vendor_id", vendorId);
          if (error) throw error;
        }
      } else {
        const { error } = await client.from("products").delete().eq("id", row.id).eq("vendor_id", vendorId);
        if (error) throw error;
      }
      await removeProductImageFiles(client, vendorId, row.id, { imageUrl: row.image_url });
    }
  } catch (error) {
    console.warn("[admin/productImages] 外した商品の掃除に失敗しました:", error);
  }
}
