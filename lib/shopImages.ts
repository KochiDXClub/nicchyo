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
 * カードや一覧に出す「その店の1枚」を決める。
 *
 * これまで相談・検索・お気に入り・地図の検索シートがそれぞれ別に書いていて、
 * 拾う順番も、カテゴリ既定画像に渡す種も食い違っていた：
 *
 *   - 相談         images.main だけ / 種は id
 *   - 検索         main → thumbnail → additional[0] / 種は position ?? id
 *   - お気に入り    main → thumbnail → additional[0] / 種は position ?? id
 *   - 検索シート    images.main だけ / 種は position ?? id
 *
 * id（1〜300）と position（0〜149）は別物なので、カテゴリ既定画像を使う店では
 * 同じ店なのに画面ごとに違う写真が出る。また main が空で thumbnail がある店は、
 * 検索では実際の写真が出るのに相談では既定画像になる。
 *
 * 拾う順番は広いほう（実際の写真があるなら必ず使う）、種は position を先にする。
 * position は運営が管理する不変の値で、id より安定しているため。
 */
type ShopPreviewSource = {
  id?: number | null;
  /** 道路上の位置。運営管理で変わらないので、既定画像の種にはこちらを優先する */
  position?: number | null;
  category?: string | null;
  images?: {
    main?: string | null;
    thumbnail?: string | null;
    additional?: (string | null | undefined)[] | null;
  } | null;
};

export function getShopPreviewImage(shop: ShopPreviewSource): string {
  const images = shop.images;
  const uploaded =
    images?.main || images?.thumbnail || images?.additional?.find(Boolean) || null;
  if (uploaded) return uploaded;

  return getShopBannerImage(shop.category, shop.position ?? shop.id ?? undefined);
}

/** その店を表す写真（後方互換エイリアス）。 */
export const resolveShopImage = getShopPreviewImage;
