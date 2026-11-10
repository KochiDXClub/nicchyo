import { normalizeSearchText } from '@/lib/search/normalizeSearchText';
import type { Shop } from '../../map/data/shops';

/**
 * 検索インデックスの型定義
 * 店舗データを正規化（小文字化・かな統一・全角半角統一）して事前計算し、高速検索を実現
 */
export interface ShopSearchIndex {
  id: number;
  nameLower: string;           // 正規化済み店舗名
  categoryLower: string;       // 正規化済みカテゴリー
  productsLower: string[];     // 正規化済み商品配列
  productsJoined: string;      // スペース区切り商品文字列（高速検索用）
  ownerNameLower: string;      // 正規化済みオーナー名
  blockNumber: number;         // ブロック番号（= id）
  chome: string | null;        // 丁目（= Shop.chome）
}

/**
 * 店舗データから検索インデックスを構築
 * キー入力ごとに300回の正規化を実行せず、事前計算で高速化
 *
 * @param shops - 店舗データ配列
 * @returns 検索インデックス配列
 */
export function buildSearchIndex(shops: Shop[]): ShopSearchIndex[] {
  return shops.map(shop => ({
    id: shop.id,
    nameLower: normalizeSearchText(shop.name),
    categoryLower: normalizeSearchText(shop.category),
    productsLower: shop.products.map(p => normalizeSearchText(p)),
    productsJoined: normalizeSearchText(shop.products.join(' ')),
    ownerNameLower: normalizeSearchText(shop.ownerName),
    blockNumber: shop.id,
    chome: shop.chome ?? null,
  }));
}
