import { MAX_PUBLIC_VENDOR_ID, parseShopIdentity } from "./identity";

export const MIN_SHOP_ID = 1;
// 店番は3桁（001〜999）。QRコード・URL（/shops/001）も3桁ゼロ埋めで扱う
export const MAX_SHOP_ID = 999;

/** 旧番号（3桁）と、店舗固有の公開番号（1000以上）を受け付ける。 */
export function normalizeShopCodeToId(shopCode: string): number | null {
  return parseShopIdentity(shopCode)?.id ?? null;
}

/**
 * 店舗ページ（/shops/[code]）が、受け付けた番号を表示・canonical に使う文字列。
 * 旧番号（場所の番号）はそのまま3桁で返す（旧 URL を開いたときの表示を変えないため）。
 * 共有・QR・案内には使わない（そちらは formatShopIdToCode）。
 */
export function formatShopPageCode(shopId: number): string {
  return shopId > MAX_SHOP_ID ? String(shopId) : String(shopId).padStart(3, "0");
}

/** 共有・QR・案内に使う店舗 ID（1000以上の店舗固有番号）だけを文字列にする。旧番号（場所の番号）は作らない。 */
export function formatShopIdToCode(shopId: number): string | null {
  if (!Number.isSafeInteger(shopId) || shopId <= MAX_SHOP_ID || shopId > MAX_PUBLIC_VENDOR_ID) return null;
  return String(shopId);
}
