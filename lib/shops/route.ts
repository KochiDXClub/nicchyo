export const MIN_SHOP_ID = 1;
// 店番は3桁（001〜999）。QRコード・URL（/shops/001）も3桁ゼロ埋めで扱う
export const MAX_SHOP_ID = 999;

const SHOP_CODE_PATTERN = /^\d{3}$/;

export function normalizeShopCodeToId(shopCode: string): number | null {
  if (!SHOP_CODE_PATTERN.test(shopCode)) {
    return null;
  }

  const shopId = Number.parseInt(shopCode, 10);

  if (Number.isNaN(shopId) || shopId < MIN_SHOP_ID || shopId > MAX_SHOP_ID) {
    return null;
  }

  return shopId;
}

export function formatShopIdToCode(shopId: number): string | null {
  if (!Number.isInteger(shopId) || shopId < MIN_SHOP_ID || shopId > MAX_SHOP_ID) {
    return null;
  }

  return shopId.toString().padStart(3, "0");
}
