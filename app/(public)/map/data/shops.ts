/**
 * 日曜市の店舗データ
 *
 * 旧静的データは廃止し、DB/API から取得する前提に変更。
 */

import type { Shop as ShopType } from "../types/shopData";
export type { Shop } from "../types/shopData";

export const shops: ShopType[] = [];

// カテゴリ名の正は config/shopCategories.ts（色定義と同居させている）。
// 既存の import を壊さないためここから再エクスポートする。
export { SHOP_CATEGORY_NAMES } from "../config/shopCategories";
export type { ShopCategory } from "../config/shopCategories";
