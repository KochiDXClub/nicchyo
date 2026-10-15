import { formatShopIdToCode } from "@/lib/shops/route";
import type { Shop } from "../map/data/shops";
import { pickIntroDemoShops, type IntroDemoShop } from "../map/components/intro/introDemoShops";

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

/**
 * 最初の写真の上に置くマーカーの店。出店者が写真を登録している店を優先し（バナーを開いたとき本物の写真が出る）、
 * 足りなければ写真の無い店で補う。カテゴリがばらける選び方は案内（pickIntroDemoShops）と同じ
 */
export function pickLandingHeroShops(shops: Shop[], count: number): IntroDemoShop[] {
  const withPhoto = shops.filter((shop) => shop.name?.trim() && uploadedShopImage(shop));
  if (withPhoto.length >= count) return pickIntroDemoShops(withPhoto, count);
  const picked = pickIntroDemoShops(withPhoto, count);
  const taken = new Set(picked.map((shop) => shop.id));
  const rest = pickIntroDemoShops(shops, count).filter((shop) => !taken.has(shop.id));
  return [...picked, ...rest].slice(0, count);
}

/** ジャンルの入口に出す、そのカテゴリの店の写真（出店者が登録した写真がある店のうち id が最小の1店）。無いカテゴリは含めない */
export function pickGenrePhotos(shops: Shop[], categories: readonly string[]): Record<string, { image: string; name: string }> {
  const result: Record<string, { image: string; name: string }> = {};
  for (const category of categories) {
    const shop = shops
      .filter((s) => s.category === category && s.name?.trim() && uploadedShopImage(s))
      .sort((a, b) => a.id - b.id)[0];
    if (shop) result[category] = { image: uploadedShopImage(shop) as string, name: shop.name.trim() };
  }
  return result;
}
