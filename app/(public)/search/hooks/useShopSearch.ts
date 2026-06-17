import { useMemo } from 'react';
import type { Shop } from '../../map/data/shops';
import { ShopSearchIndex } from '../lib/searchIndex';

/**
 * 検索フックのパラメータ
 */
interface UseShopSearchParams {
  shops: Shop[];
  searchIndex: ShopSearchIndex[];
  textQuery: string;
  category: string | null;
  chome: string | null;
}

type RankedShop = {
  shop: Shop;
  score: number;
  originalIndex: number;
};

function scoreTextMatch(target: string, query: string): number {
  if (target === query) return 300;
  if (target.startsWith(query)) return 220;
  if (target.includes(query)) return 140;
  return 0;
}

function scoreSearchIndex(idx: ShopSearchIndex, query: string, category: string | null, chome: string | null): number {
  let score = 0;

  if (category) {
    const catLower = category.toLowerCase();
    if (idx.categoryLower === catLower) {
      score += 80;
    }
  }

  if (chome) {
    if (idx.chome === chome) {
      score += 60;
    }
  }

  if (query) {
    score += scoreTextMatch(idx.nameLower, query);
    score += scoreTextMatch(idx.categoryLower, query) / 2;
    score += scoreTextMatch(idx.ownerNameLower, query) / 2;

    for (const product of idx.productsLower) {
      score += scoreTextMatch(product, query);
    }

    if (idx.productsJoined.includes(query)) {
      score += 120;
    }

    const queryParts = query.split(/\s+/).filter(Boolean);
    if (queryParts.length > 1) {
      const allPartsMatched = queryParts.every((part) =>
        idx.nameLower.includes(part) ||
        idx.categoryLower.includes(part) ||
        idx.ownerNameLower.includes(part) ||
        idx.productsJoined.includes(part)
      );
      if (allPartsMatched) {
        score += 90;
      }
    }
  }

  return score;
}

/**
 * 店舗検索フック
 * UIから検索ロジックを分離し、useMemoで最適化
 *
 * フィルタリング優先順位:
 * 1. カテゴリー（完全一致）
 * 2. テキストクエリ（部分一致、名前・商品・オーナー名）
 *
 * @param params - 検索パラメータ
 * @returns フィルタリングされた店舗配列
 */
export function useShopSearch({
  shops,
  searchIndex,
  textQuery,
  category,
  chome,
}: UseShopSearchParams): Shop[] {
  return useMemo(() => {
    const normalizedQuery = textQuery.trim().toLowerCase();
    const shopsById = new Map(shops.map((shop) => [shop.id, shop]));
    const ranked: RankedShop[] = searchIndex.map((idx, originalIndex) => ({
      shop: shopsById.get(idx.id) ?? shops[originalIndex],
      score: 0,
      originalIndex,
    }));

    // カテゴリーフィルター（完全一致）
    if (category) {
      const catLower = category.toLowerCase();
      ranked.forEach((item) => {
        const idx = searchIndex[item.originalIndex];
        if (idx.categoryLower !== catLower) {
          item.score = -1;
        } else {
          item.score += 80;
        }
      });
    }

    // 丁目フィルター（完全一致）
    if (chome) {
      ranked.forEach((item) => {
        const idx = searchIndex[item.originalIndex];
        if (idx.chome !== chome) {
          item.score = -1;
        } else if (item.score >= 0) {
          item.score += 60;
        }
      });
    }

    // テキストクエリフィルター（部分一致）
    if (normalizedQuery) {
      ranked.forEach((item) => {
        if (item.score < 0) return;
        const idx = searchIndex[item.originalIndex];
        const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);
        const matchesText =
          idx.nameLower.includes(normalizedQuery) ||
          idx.productsJoined.includes(normalizedQuery) ||
          idx.ownerNameLower.includes(normalizedQuery) ||
          idx.categoryLower.includes(normalizedQuery);

        const matchesParts = queryParts.length > 1
          ? queryParts.every((part) =>
              idx.nameLower.includes(part) ||
              idx.productsJoined.includes(part) ||
              idx.ownerNameLower.includes(part) ||
              idx.categoryLower.includes(part)
            )
          : false;

        if (!matchesText && !matchesParts) {
          item.score = -1;
          return;
        }

        item.score += scoreSearchIndex(idx, normalizedQuery, category, chome);
      });
    }

    const result = ranked
      .filter((item) => item.score >= 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.originalIndex - b.originalIndex;
      })
      .map((item) => item.shop);

    return result;
  }, [shops, searchIndex, textQuery, category, chome]);
}
