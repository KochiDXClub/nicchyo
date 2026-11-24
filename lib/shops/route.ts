import { MAX_PUBLIC_VENDOR_ID, parseShopIdentity } from "./identity";

export const MIN_SHOP_ID = 1;
// 店番は3桁（001〜999）。QRコード・URL（/shops/001）も3桁ゼロ埋めで扱う
export const MAX_SHOP_ID = 999;

/** URL の店舗コード（店舗 ID、1000以上）を数値にする。旧番号（001 形式）は null。 */
export function normalizeShopCodeToId(shopCode: string): number | null {
  return parseShopIdentity(shopCode);
}

/** 共有・QR・案内に使う店舗 ID（1000以上の店舗固有番号）だけを文字列にする。旧番号（場所の番号）は作らない。 */
export function formatShopIdToCode(shopId: number): string | null {
  if (!Number.isSafeInteger(shopId) || shopId <= MAX_SHOP_ID || shopId > MAX_PUBLIC_VENDOR_ID) return null;
  return String(shopId);
}
