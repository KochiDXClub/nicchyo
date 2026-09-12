const CATEGORY_BANNER_MAP: Record<string, string[]> = {
  "食材": ["/images/shops/ninjin.webp", "/images/shops/retasu.webp"],
  "食べ物": ["/images/shops/imotenn.webp", "/images/shops/icecream.webp"],
  "道具・工具": ["/images/shops/kougu.webp", "/images/shops/houtyou.webp"],
  "生活雑貨": [
    "/images/shops/takekago.webp",
    "/images/shops/dish.webp",
    "/images/shops/towel.webp",
  ],
  "植物・苗": ["/images/shops/uekibachi.webp", "/images/shops/seed.webp"],
  "アクセサリー": ["/images/shops/accessories.webp", "/images/shops/hairpin.webp"],
  "手作り・工芸": ["/images/shops/handcraft.webp", "/images/shops/kawazaiku.webp"],
};
const DEFAULT_BANNERS = ["/images/shops/tosahamono.webp"];

function pickFromList(images: string[], seed?: number | string) {
  if (images.length === 1) return images[0];
  if (seed === undefined || seed === null) {
    return images[Math.floor(Math.random() * images.length)];
  }
  const numericSeed = typeof seed === "number" ? seed : hashSeed(seed);
  const index = Math.abs(numericSeed) % images.length;
  return images[index];
}

function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

export function getShopBannerImage(category?: string | null, seed?: number | string) {
  const images = category ? CATEGORY_BANNER_MAP[category] : undefined;
  return pickFromList(images ?? DEFAULT_BANNERS, seed);
}

/**
 * その店を表す写真。バナー・マーカーの丸窓・OGP・案内カードで同じものを使う。
 * 出店者が登録した写真があればそれ、無ければカテゴリの既定写真（店ごとに固定）
 */
export function resolveShopImage(shop: {
  id: number;
  category?: string | null;
  position?: number;
  images?: { main?: string };
}) {
  return shop.images?.main ?? getShopBannerImage(shop.category, shop.position ?? shop.id);
}
