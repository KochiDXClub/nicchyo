import type { ShopProfile as Shop } from '../../map/types/shopData';

/**
 * 検索インデックスの型定義
 * 店舗データを小文字化して事前計算し、高速検索を実現
 */
export interface ShopSearchIndex {
  id: number;
  nameLower: string;           // 小文字化済み店舗名
  categoryLower: string;       // 小文字化済みカテゴリー
  productsLower: string[];     // 小文字化済み商品配列
  productsJoined: string;      // スペース区切り商品文字列（高速検索用）
  ownerNameLower: string;      // 小文字化済みオーナー名
  blockNumber: number;         // ブロック番号（= id）
  chome: string | null;        // 丁目（= Shop.chome）
}

/**
 * 店舗データから検索インデックスを構築
 * キー入力ごとに300回のtoLowerCaseを実行せず、事前計算で高速化
 *
 * @param shops - 店舗データ配列
 * @returns 検索インデックス配列
 */
export function buildSearchIndex(shops: Shop[]): ShopSearchIndex[] {
  return shops.map(shop => ({
    id: shop.id,
    nameLower: shop.name.toLowerCase(),
    categoryLower: shop.category.toLowerCase(),
    productsLower: shop.products.map(p => p.toLowerCase()),
    productsJoined: shop.products.join(' ').toLowerCase(),
    ownerNameLower: shop.ownerName.toLowerCase(),
    blockNumber: shop.id,
    chome: shop.chome ?? null,
  }));
}
