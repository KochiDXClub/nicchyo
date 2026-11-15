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
 * 店舗写真の種類。登録のとき（運営の現地登録・出店者の写真登録）に選んだラベルで決める。
 *   normal   … 普通の写真
 *   panorama … 全周カメラ（360度）の写真。横:縦 = 2:1
 * 写真の比率からの自動判定はしない（普通の写真が 2:1 に切り抜かれていても、全周にはしないため）。
 */
export const SHOP_IMAGE_KINDS = ["normal", "panorama"] as const;
export type ShopImageKind = (typeof SHOP_IMAGE_KINDS)[number];

/** DB や API から来た値を ShopImageKind にそろえる。未設定・未知の値は普通の写真 */
export function normalizeShopImageKind(value: unknown): ShopImageKind {
  return value === "panorama" ? "panorama" : "normal";
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
 * 旧 ID と position は別物なので、カテゴリ既定画像を使う店では
 * 同じ店なのに画面ごとに違う写真が出る。また main が空で thumbnail がある店は、
 * 検索では実際の写真が出るのに相談では既定画像になる。
 *
 * 固定店舗 ID（1000 以上）は出店場所が変わっても同じなので、写真の種に使う。
 * 旧 ID は従来どおり position を先に使う。
 */
export type ShopPreviewSource = {
  id?: number | null;
  /** 道路上の位置。旧 ID の店では既定画像の種に使う */
  position?: number | null;
  category?: string | null;
  categoryKey?: string | null;
  images?: {
    main?: string | null;
    thumbnail?: string | null;
    /** main の種類。未設定は普通の写真 */
    mainKind?: ShopImageKind | null;
    additional?: (string | null | undefined)[] | null;
  } | null;
};

export function getShopPreviewImage(shop: ShopPreviewSource): string {
  const images = shop.images;
  const uploaded =
    images?.main || images?.thumbnail || images?.additional?.find(Boolean) || null;
  if (uploaded) return uploaded;

  const seed = typeof shop.id === "number" && shop.id >= 1000 ? shop.id : shop.position ?? shop.id ?? undefined;
  return getShopBannerImage(shop.categoryKey ?? shop.category, seed);
}

/** その店を表す写真（後方互換エイリアス）。 */
export const resolveShopImage = getShopPreviewImage;

/**
 * URL が店舗メイン画像（store-main.*）かどうかを判定する
 */
export function isStoreMainImage(url: string): boolean {
  return /(^|\/)store-main\.[a-zA-Z0-9]+(\?.*)?$/.test(url);
}

/**
 * store-main.* の画像 URL から対応するサムネイル URL（store-thumb.webp）を導出する
 */
export function toStoreThumbUrl(url: string): string {
  return url.replace(/(^|\/)store-main\.[a-zA-Z0-9]+/, "$1store-thumb.webp");
}

/**
 * マップの丸窓写真やスキャンカードなど、小さな枠（128px〜200px前後）で表示する写真 URL を解決する。
 *
 * 1. shop.images.thumbnail があれば最優先
 * 2. main 画像が store-main.* の場合、軽量な store-thumb.webp に置き換えて返す
 * 3. それ以外（過去の画像や外部URL、既定画像など）は通常の getShopPreviewImage を返す
 */
export function getShopThumbnailImage(shop: ShopPreviewSource): string {
  if (shop.images?.thumbnail) {
    return shop.images.thumbnail;
  }

  const mainUrl = shop.images?.main;
  if (mainUrl && isStoreMainImage(mainUrl)) {
    return toStoreThumbUrl(mainUrl);
  }

  return getShopPreviewImage(shop);
}

/**
 * 地図の写真入り屋台に使う写真 URL。
 *
 * 通常は軽いサムネイルを使う。最大ズームより先まで寄ったとき（highRes）は、屋台が 2 倍に大きくなり
 * サムネイル（store-thumb.webp）の画素数では足りないので、元の main 画像（長辺 1200px）を使う。
 * 全周写真の main は横長の全景で、サムネイルが中央を切り出したものなので、main には替えない。
 * main が読めないときの控えは呼び出し側が getShopThumbnailImage を渡す。
 */
export function getShopMapPhotoImage(shop: ShopPreviewSource, highRes: boolean): string {
  const mainUrl = shop.images?.main;
  if (highRes && mainUrl && isStoreMainImage(mainUrl) && shop.images?.mainKind !== "panorama") {
    return mainUrl;
  }
  return getShopThumbnailImage(shop);
}
