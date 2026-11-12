/** 市内で一意の住所番号と、その住所の中での店舗番号は別の値。 */
export type MarketAddress = { main: number; branch: number | null };

/** 全角数字・ハイフンと前後の空白を受け付け、住所の枝番を店舗番号と混同しない。 */
export function parseMarketAddress(input: string): MarketAddress | null {
  const normalized = input.normalize("NFKC").trim();
  const match = /^(\d{1,6})(?:\s*-\s*(\d{1,6}))?$/.exec(normalized);
  if (!match) return null;
  const main = Number(match[1]);
  const branch = match[2] === undefined ? null : Number(match[2]);
  if (main < 1 || (branch !== null && branch < 1)) return null;
  return { main, branch };
}
export function formatMarketAddress(address: MarketAddress): string {
  return address.branch === null ? String(address.main) : `${address.main}-${address.branch}`;
}
export function formatPlaceVendorNumber(address: MarketAddress, vendorNumber: number | null): string {
  const place = formatMarketAddress(address);
  return vendorNumber === null ? `住所 ${place} ／ 店舗番号未設定` : `住所 ${place} ／ 店舗${vendorNumber}`;
}
