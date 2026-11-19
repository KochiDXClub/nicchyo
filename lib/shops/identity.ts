/** 旧 URL は場所番号、新 URL は出店者固有番号。番号空間を混ぜない。 */
export type ShopIdentity = { kind: "legacy" | "vendor"; id: number };
export const MAX_PUBLIC_VENDOR_ID = 2147483647;

export function parseShopIdentity(code: string): ShopIdentity | null {
  if (/^\d{3}$/.test(code)) {
    const id = Number(code);
    return id >= 1 ? { kind: "legacy", id } : null;
  }
  if (!/^[1-9]\d{3,9}$/.test(code)) return null;
  const id = Number(code);
  return id >= 1000 && id <= MAX_PUBLIC_VENDOR_ID ? { kind: "vendor", id } : null;
}

/** 公開中の店舗に明示的に確認された対応だけを返す。推測しない。 */
export function resolveLegacyShopId(legacyId: number, aliases: ReadonlyMap<number, number>, visibleVendorIds: ReadonlySet<number>): number | null {
  const vendorId = aliases.get(legacyId);
  return vendorId !== undefined && visibleVendorIds.has(vendorId) ? vendorId : null;
}
