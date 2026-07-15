import { describe, it, expect } from 'vitest';
import {
  deriveInterestCategories,
  selectNearbyRecommendations,
} from './nearbyRecommendations';

type TestShop = { id: number; category?: string };

// 近い順で並んでいる前提の範囲内店舗
const AREA_SHOPS: TestShop[] = [
  { id: 1, category: '食材' },
  { id: 2, category: '食べ物' },
  { id: 3, category: '食材' },
  { id: 4, category: '植物・苗' },
  { id: 5, category: '食べ物' },
  { id: 6, category: 'アクセサリー' },
  { id: 7, category: '食材' },
];

describe('selectNearbyRecommendations', () => {
  it('範囲内のお気に入りを最優先で選ぶ（最大2つ）', () => {
    const picks = selectNearbyRecommendations(AREA_SHOPS, {
      favoriteShopIds: new Set([3, 5, 6]),
      interestCategories: [],
    });
    const favorites = picks.filter((p) => p.reason === 'favorite');
    expect(favorites.map((p) => p.shop.id)).toEqual([3, 5]);
  });

  it('興味ジャンルに一致する店を近い順に選ぶ', () => {
    const picks = selectNearbyRecommendations(AREA_SHOPS, {
      favoriteShopIds: new Set(),
      interestCategories: ['食べ物'],
    });
    const interest = picks.filter((p) => p.reason === 'interest');
    expect(interest[0]?.shop.id).toBe(2); // 最も近い「食べ物」
  });

  it('興味一致だけで埋めず、出会い枠（未登場ジャンル）を必ず残す', () => {
    const picks = selectNearbyRecommendations(AREA_SHOPS, {
      favoriteShopIds: new Set(),
      interestCategories: ['食材', '食べ物'],
      limit: 5,
    });
    const discoveries = picks.filter((p) => p.reason === 'discovery');
    expect(discoveries.length).toBeGreaterThanOrEqual(1);
    // 出会い枠は興味ジャンル以外から選ばれている
    expect(
      discoveries.some(
        (p) => p.shop.category !== '食材' && p.shop.category !== '食べ物'
      )
    ).toBe(true);
  });

  it('行動シグナルがない場合はジャンルの多様性を優先して埋める', () => {
    const picks = selectNearbyRecommendations(AREA_SHOPS, {
      favoriteShopIds: new Set(),
      interestCategories: [],
      limit: 4,
    });
    expect(picks).toHaveLength(4);
    const categories = picks.map((p) => p.shop.category);
    // 近い順かつジャンル重複なしで選ばれる
    expect(new Set(categories).size).toBe(4);
    expect(picks[0].shop.id).toBe(1);
  });

  it('limit と範囲内店舗数を超えない', () => {
    const picks = selectNearbyRecommendations(AREA_SHOPS.slice(0, 2), {
      favoriteShopIds: new Set([1]),
      interestCategories: ['食べ物'],
      limit: 5,
    });
    expect(picks).toHaveLength(2);
    const ids = picks.map((p) => p.shop.id);
    expect(new Set(ids).size).toBe(ids.length); // 重複なし
  });
});

describe('deriveInterestCategories', () => {
  it('シグナルの多いジャンル順に返す', () => {
    const categoryById = new Map<number, string>([
      [1, '食材'],
      [2, '食べ物'],
      [3, '食材'],
      [4, '食材'],
    ]);
    const result = deriveInterestCategories([1, 2, 3, 4], (id) =>
      categoryById.get(id)
    );
    expect(result).toEqual(['食材', '食べ物']);
  });

  it('カテゴリ不明のIDは無視する', () => {
    const result = deriveInterestCategories([1, 99], (id) =>
      id === 1 ? '食材' : undefined
    );
    expect(result).toEqual(['食材']);
  });
});
