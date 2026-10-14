import { formatShopIdToCode } from "@/lib/shops/route";
import type { Shop } from "../map/data/shops";

/** 「出店しているお店から」に並べる1枚 */
export type LandingShopPhoto = { id: number; code: string; name: string; image: string };

/** 細長い写真の帯に並べる最大の枚数 */
export const LANDING_SHOP_PHOTO_LIMIT = 8;

/**
 * 出店者が自分で登録した写真。カテゴリの既定画像（イラスト）は「写真」ではないので数えない。
 * next/image で配れる場所（自サイトか Supabase Storage）にあるものだけを使う
 */
export function uploadedShopImage(shop: Shop): string | null {
  const images = shop.images;
  const src = images?.main || images?.thumbnail || images?.additional?.find(Boolean);
  if (!src) return null;
  if (src.startsWith("/")) return src;
  try {
    return new URL(src).hostname.endsWith(".supabase.co") ? src : null;
  } catch {
    return null;
  }
}

/**
 * トップページで使う店を選ぶ。
 *
 * - showcase … 「お店の紹介」で開いて見せる1店。写真があり、商品も一言もそろっている店を優先する
 * - photos   … 写真の帯に並べる店（showcase とは重ねない）
 *
 * 並びは id 順に固定して、開くたびに変わらないようにする。
 * 写真のある店が無ければ showcase は null（作り物の店は出さない）
 */
export function pickLandingShops(shops: Shop[]): { showcase: Shop | null; photos: LandingShopPhoto[] } {
  const withPhoto = shops
    .filter((shop) => shop.name?.trim() && formatShopIdToCode(shop.id) !== null && uploadedShopImage(shop))
    .sort((a, b) => a.id - b.id);

  const completeness = (shop: Shop) =>
    (shop.products.length > 0 ? 2 : 0) + (shop.catchphrase?.trim() ? 1 : 0) + (shop.shopStrength?.trim() ? 1 : 0);
  // sort は安定なので、点数が同じなら id 順のまま
  const showcase = [...withPhoto].sort((a, b) => completeness(b) - completeness(a))[0] ?? null;

  const photos = withPhoto
    .filter((shop) => shop.id !== showcase?.id)
    .slice(0, LANDING_SHOP_PHOTO_LIMIT)
    .map((shop) => ({
      id: shop.id,
      code: formatShopIdToCode(shop.id) as string,
      name: shop.name.trim(),
      image: uploadedShopImage(shop) as string,
    }));

  return { showcase, photos };
}
