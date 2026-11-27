/** 店舗 ID（出店者ごとの恒久番号、1000 以上）の範囲。場所の番号（001〜999）は店舗 ID ではない。 */
export const MIN_PUBLIC_VENDOR_ID = 1000;
export const MAX_PUBLIC_VENDOR_ID = 2147483647;

/** URL の店舗コード（10進数の店舗 ID）だけを受け付ける。001 形式などの旧番号は null（404 にする）。 */
export function parseShopIdentity(code: string): number | null {
  if (!/^[1-9]\d{3,9}$/.test(code)) return null;
  const id = Number(code);
  return id >= MIN_PUBLIC_VENDOR_ID && id <= MAX_PUBLIC_VENDOR_ID ? id : null;
}
