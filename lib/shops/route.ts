import { MAX_PUBLIC_VENDOR_ID, parseShopIdentity } from "./identity";

export const MIN_SHOP_ID = 1;
// 店番は3桁（001〜999）。QRコード・URL（/shops/001）も3桁ゼロ埋めで扱う
export const MAX_SHOP_ID = 999;

/** 旧番号（3桁）と、店舗固有の公開番号（1000以上）を受け付ける。 */
export function normalizeShopCodeToId(shopCode: string): number | null {
  return parseShopIdentity(shopCode)?.id ?? null;
}

export function formatShopIdToCode(shopId: number): string | null {
  if (!Number.isSafeInteger(shopId) || shopId < MIN_SHOP_ID || shopId > MAX_PUBLIC_VENDOR_ID) return null;
  return shopId <= MAX_SHOP_ID ? shopId.toString().padStart(3, "0") : String(shopId);
}
