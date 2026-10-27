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
 * 「出店しているお店から」の写真の帯に並べる店を選ぶ。
 * 出店者が自分で写真を登録した店だけを、id 順（開くたびに変わらないように）で上限まで
 */
export function pickLandingShopPhotos(shops: Shop[]): LandingShopPhoto[] {
  return shops
    .filter((shop) => shop.name?.trim() && formatShopIdToCode(shop.id) !== null && uploadedShopImage(shop))
    .sort((a, b) => a.id - b.id)
    .slice(0, LANDING_SHOP_PHOTO_LIMIT)
    .map((shop) => ({
      id: shop.id,
      code: formatShopIdToCode(shop.id) as string,
      name: shop.name.trim(),
      image: uploadedShopImage(shop) as string,
    }));
}
