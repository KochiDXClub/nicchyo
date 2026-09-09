import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadFavoriteShopIds,
  saveFavoriteShopIds,
  toggleFavoriteShopId,
  loadFavoriteEntries,
  saveFavoriteEntries,
  toggleFavoriteShop,
  toggleFavoriteProduct,
  removeFavoriteShop,
  isShopFavorited,
  isProductFavorited,
  getFavoriteProductsForShop,
  groupFavoritesByShop,
  favoriteEntryKey,
  migrateBagItemsToFavorites,
  clearLegacyShoppingChecklist,
  LEGACY_SHOPPING_CHECKED_KEY,
  BAG_MIGRATION_FLAG_KEY,
  LEGACY_BAG_STORAGE_KEY,
  FAVORITE_SHOPS_KEY,
  FAVORITE_SHOPS_UPDATED_EVENT,
  type FavoriteEntry,
} from './favoriteShops';

/** 保存済みJSONを、時刻に依存しない形で読み出す */
function storedEntries(): Array<Pick<FavoriteEntry, 'shopId' | 'product'>> {
  const raw = localStorage.getItem(FAVORITE_SHOPS_KEY);
  return JSON.parse(raw ?? '[]').map((entry: FavoriteEntry) => ({
    shopId: entry.shopId,
    product: entry.product,
  }));
}

function seed(entries: Array<Pick<FavoriteEntry, 'shopId' | 'product'>>) {
  localStorage.setItem(
    FAVORITE_SHOPS_KEY,
    JSON.stringify(entries.map((entry, i) => ({ ...entry, addedAt: 1000 + i }))),
  );
}

describe('favoriteShops', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('favoriteEntryKey', () => {
    it('店ごとの行と商品の行で別のキーになる', () => {
      expect(favoriteEntryKey(1, null)).toBe('1:');
      expect(favoriteEntryKey(1, 'いも天')).toBe('1:いも天');
    });
  });

  describe('loadFavoriteEntries', () => {
    it('保存が空なら空配列を返す', () => {
      expect(loadFavoriteEntries()).toEqual([]);
    });

    it('新形式をそのまま読める', () => {
      seed([{ shopId: 1, product: null }, { shopId: 1, product: 'いも天' }]);
      expect(loadFavoriteEntries()).toEqual([
        { shopId: 1, product: null, addedAt: 1000 },
        { shopId: 1, product: 'いも天', addedAt: 1001 },
      ]);
    });

    it('旧形式（number[]）を店ごとのお気に入りとして読み替える', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([1, 2, 3]));
      expect(loadFavoriteEntries().map((e) => ({ shopId: e.shopId, product: e.product }))).toEqual([
        { shopId: 1, product: null },
        { shopId: 2, product: null },
        { shopId: 3, product: null },
      ]);
    });

    it('旧形式は読むたびに addedAt が変わらない（追加順の並びが揺れない）', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([1, 2, 3]));
      const first = loadFavoriteEntries();
      const second = loadFavoriteEntries();
      expect(second).toEqual(first);
    });

    it('旧形式は保存されていた順を addedAt の昇順として残す', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([7, 8, 9]));
      const addedAt = loadFavoriteEntries().map((e) => e.addedAt);
      expect(addedAt[0]).toBeLessThan(addedAt[1]);
      expect(addedAt[1]).toBeLessThan(addedAt[2]);
    });

    it('addedAt が無い行は読むたびに変わらない', () => {
      localStorage.setItem(
        FAVORITE_SHOPS_KEY,
        JSON.stringify([{ shopId: 1, product: 'いも天' }]),
      );
      expect(loadFavoriteEntries()).toEqual(loadFavoriteEntries());
    });

    it('旧形式に null が混ざっても幽霊の店を作らない', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([1, null, 2]));
      expect(loadFavoriteEntries().map((e) => e.shopId)).not.toContain(0);
    });

    it('同じ店・同じ商品の重複を落とす', () => {
      seed([
        { shopId: 1, product: 'いも天' },
        { shopId: 1, product: 'いも天' },
        { shopId: 1, product: null },
      ]);
      expect(loadFavoriteEntries()).toHaveLength(2);
    });

    it('空文字・空白だけの商品名は「店ごと」として扱う', () => {
      seed([{ shopId: 1, product: '   ' }]);
      expect(loadFavoriteEntries()[0].product).toBeNull();
    });

    it('shopId が数値にならない行は捨てる', () => {
      localStorage.setItem(
        FAVORITE_SHOPS_KEY,
        JSON.stringify([
          { shopId: 'abc', product: null, addedAt: 1000 },
          { shopId: 2, product: null, addedAt: 1001 },
        ]),
      );
      expect(loadFavoriteEntries().map((e) => e.shopId)).toEqual([2]);
    });

    it('壊れたJSONなら空配列を返す', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, '{invalid-json}');
      expect(loadFavoriteEntries()).toEqual([]);
    });
  });

  describe('saveFavoriteEntries', () => {
    it('保存して更新イベントを飛ばす', () => {
      const listener = vi.fn();
      window.addEventListener(FAVORITE_SHOPS_UPDATED_EVENT, listener);

      saveFavoriteEntries([{ shopId: 5, product: null, addedAt: 1 }]);

      expect(storedEntries()).toEqual([{ shopId: 5, product: null }]);
      expect(listener).toHaveBeenCalledTimes(1);
      expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual([
        { shopId: 5, product: null, addedAt: 1 },
      ]);

      window.removeEventListener(FAVORITE_SHOPS_UPDATED_EVENT, listener);
    });
  });

  describe('ハートの点灯判定', () => {
    it('商品だけ入れた店でも、店のハートは点灯する', () => {
      const entries = loadFavoriteEntries();
      seed([{ shopId: 7, product: 'いも天' }]);
      expect(isShopFavorited(entries, 7)).toBe(false);
      expect(isShopFavorited(loadFavoriteEntries(), 7)).toBe(true);
    });

    it('商品の点灯はその商品だけを見る', () => {
      seed([{ shopId: 7, product: 'いも天' }]);
      const entries = loadFavoriteEntries();
      expect(isProductFavorited(entries, 7, 'いも天')).toBe(true);
      expect(isProductFavorited(entries, 7, 'かんざし')).toBe(false);
      expect(isProductFavorited(entries, 8, 'いも天')).toBe(false);
    });
  });

  describe('getFavoriteProductsForShop', () => {
    it('店ごとの行は含めず、商品名だけを返す', () => {
      seed([
        { shopId: 1, product: null },
        { shopId: 1, product: 'いも天' },
        { shopId: 2, product: 'ゆず' },
      ]);
      expect(getFavoriteProductsForShop(loadFavoriteEntries(), 1)).toEqual(['いも天']);
    });
  });

  describe('groupFavoritesByShop', () => {
    it('店ごとにまとめ、最近入れた店から並べる', () => {
      seed([
        { shopId: 1, product: null },
        { shopId: 1, product: 'いも天' },
        { shopId: 2, product: 'ゆず' },
      ]);
      expect(groupFavoritesByShop(loadFavoriteEntries())).toEqual([
        { shopId: 2, products: ['ゆず'], addedAt: 1002 },
        { shopId: 1, products: ['いも天'], addedAt: 1000 },
      ]);
    });

    it('商品ゼロの店も残す', () => {
      seed([{ shopId: 3, product: null }]);
      expect(groupFavoritesByShop(loadFavoriteEntries())).toEqual([
        { shopId: 3, products: [], addedAt: 1000 },
      ]);
    });
  });

  describe('toggleFavoriteShop', () => {
    it('消灯→点灯で「店ごと」の行を足す', () => {
      toggleFavoriteShop(3);
      expect(storedEntries()).toEqual([{ shopId: 3, product: null }]);
    });

    it('点灯→消灯でその店の行をすべて消す', () => {
      seed([
        { shopId: 1, product: null },
        { shopId: 1, product: 'いも天' },
        { shopId: 2, product: null },
      ]);
      toggleFavoriteShop(1);
      expect(storedEntries()).toEqual([{ shopId: 2, product: null }]);
    });

    it('商品だけの店を消すと、その商品も消える', () => {
      seed([{ shopId: 1, product: 'いも天' }]);
      toggleFavoriteShop(1);
      expect(storedEntries()).toEqual([]);
    });
  });

  describe('toggleFavoriteProduct', () => {
    it('商品の行だけを足す', () => {
      seed([{ shopId: 1, product: null }]);
      toggleFavoriteProduct(1, 'いも天');
      expect(storedEntries()).toEqual([
        { shopId: 1, product: null },
        { shopId: 1, product: 'いも天' },
      ]);
    });

    it('店をお気に入りにしていなくても、商品だけ足せる', () => {
      toggleFavoriteProduct(9, 'ゆず');
      expect(storedEntries()).toEqual([{ shopId: 9, product: 'ゆず' }]);
      expect(isShopFavorited(loadFavoriteEntries(), 9)).toBe(true);
    });

    it('もう一度押すとその商品の行だけ消える', () => {
      seed([
        { shopId: 1, product: null },
        { shopId: 1, product: 'いも天' },
      ]);
      toggleFavoriteProduct(1, 'いも天');
      expect(storedEntries()).toEqual([{ shopId: 1, product: null }]);
    });

    it('空白だけの商品名は無視する', () => {
      toggleFavoriteProduct(1, '   ');
      expect(storedEntries()).toEqual([]);
    });
  });

  describe('removeFavoriteShop', () => {
    it('その店の行をすべて消す', () => {
      seed([
        { shopId: 1, product: 'いも天' },
        { shopId: 2, product: null },
      ]);
      removeFavoriteShop(1);
      expect(storedEntries()).toEqual([{ shopId: 2, product: null }]);
    });
  });


  describe('migrateBagItemsToFavorites', () => {
    it('店が分かるバッグの中身をお気に入りへ移す', () => {
      localStorage.setItem(
        LEGACY_BAG_STORAGE_KEY,
        JSON.stringify([
          { id: 'a', name: 'いも天', fromShopId: 1, createdAt: 1 },
          { id: 'b', name: 'ゆず', fromShopId: 2, createdAt: 2 },
        ]),
      );

      expect(migrateBagItemsToFavorites()).toEqual({ migrated: 2, skipped: 0 });
      expect(storedEntries()).toEqual([
        { shopId: 1, product: 'いも天' },
        { shopId: 2, product: 'ゆず' },
      ]);
    });

    it('店が分からないものは取り込まず、数だけ返す', () => {
      localStorage.setItem(
        LEGACY_BAG_STORAGE_KEY,
        JSON.stringify([
          { id: 'a', name: '牛乳', createdAt: 1 },
          { id: 'b', name: 'いも天', fromShopId: 1, createdAt: 2 },
        ]),
      );

      expect(migrateBagItemsToFavorites()).toEqual({ migrated: 1, skipped: 1 });
      expect(storedEntries()).toEqual([{ shopId: 1, product: 'いも天' }]);
    });

    it('すでにお気に入りにあるものは重ねない', () => {
      seed([{ shopId: 1, product: 'いも天' }]);
      localStorage.setItem(
        LEGACY_BAG_STORAGE_KEY,
        JSON.stringify([{ id: 'a', name: 'いも天', fromShopId: 1, createdAt: 1 }]),
      );

      expect(migrateBagItemsToFavorites()).toEqual({ migrated: 0, skipped: 0 });
      expect(storedEntries()).toEqual([{ shopId: 1, product: 'いも天' }]);
    });

    it('2回目以降は何もしない（外したものが復活しない）', () => {
      localStorage.setItem(
        LEGACY_BAG_STORAGE_KEY,
        JSON.stringify([{ id: 'a', name: 'いも天', fromShopId: 1, createdAt: 1 }]),
      );
      migrateBagItemsToFavorites();
      removeFavoriteShop(1);

      expect(migrateBagItemsToFavorites()).toBeNull();
      expect(storedEntries()).toEqual([]);
    });

    it('バッグが空でも移行済みの印は立てる', () => {
      expect(migrateBagItemsToFavorites()).toEqual({ migrated: 0, skipped: 0 });
      expect(localStorage.getItem(BAG_MIGRATION_FLAG_KEY)).toBe('1');
      expect(migrateBagItemsToFavorites()).toBeNull();
    });

    it('保存に失敗したら印を立てない（次の起動でやり直せる）', () => {
      localStorage.setItem(
        LEGACY_BAG_STORAGE_KEY,
        JSON.stringify([{ name: 'いも天', fromShopId: 12 }]),
      );
      const setItem = vi
        .spyOn(Storage.prototype, 'setItem')
        .mockImplementation((key: string) => {
          if (key === FAVORITE_SHOPS_KEY) throw new Error('QuotaExceededError');
        });

      expect(() => migrateBagItemsToFavorites()).toThrow();
      setItem.mockRestore();

      expect(localStorage.getItem(BAG_MIGRATION_FLAG_KEY)).toBeNull();
      // やり直すと今度は移せる
      expect(migrateBagItemsToFavorites()).toEqual({ migrated: 1, skipped: 0 });
    });

    it('バッグのJSONが壊れていても落ちない', () => {
      localStorage.setItem(LEGACY_BAG_STORAGE_KEY, '{invalid-json}');
      expect(migrateBagItemsToFavorites()).toEqual({ migrated: 0, skipped: 0 });
      expect(storedEntries()).toEqual([]);
    });
  });

  describe('clearLegacyShoppingChecklist', () => {
    it('買い物チェックリストを消す（お気に入りには持ち込まない）', () => {
      localStorage.setItem(LEGACY_SHOPPING_CHECKED_KEY, JSON.stringify(['a']));
      clearLegacyShoppingChecklist();
      expect(localStorage.getItem(LEGACY_SHOPPING_CHECKED_KEY)).toBeNull();
    });

    it('移行元のバッグ本体は消さない（移行に失敗していたときの控え）', () => {
      localStorage.setItem(LEGACY_BAG_STORAGE_KEY, JSON.stringify([]));
      clearLegacyShoppingChecklist();
      expect(localStorage.getItem(LEGACY_BAG_STORAGE_KEY)).not.toBeNull();
    });
  });

  describe('互換API', () => {
    it('loadFavoriteShopIds は旧形式をそのまま読める', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([1, 2, 3]));
      expect(loadFavoriteShopIds()).toEqual([1, 2, 3]);
    });

    it('loadFavoriteShopIds は旧形式の値を正規化する', () => {
      // "2" -> 2、null は捨てる（0 番の店にしない）、重複した 1 は落ちる
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([1, '2', null, 1, 3]));
      expect(loadFavoriteShopIds()).toEqual([1, 2, 3]);
    });

    it('loadFavoriteShopIds は数値にならない値を捨てる', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([1, 'abc', 3]));
      expect(loadFavoriteShopIds()).toEqual([1, 3]);
    });

    it('loadFavoriteShopIds は商品だけの店も1件として返す', () => {
      seed([
        { shopId: 1, product: 'いも天' },
        { shopId: 1, product: null },
        { shopId: 2, product: 'ゆず' },
      ]);
      expect(loadFavoriteShopIds()).toEqual([1, 2]);
    });

    it('saveFavoriteShopIds は指定した店だけを残す', () => {
      saveFavoriteShopIds([10, 20]);
      expect(storedEntries()).toEqual([
        { shopId: 10, product: null },
        { shopId: 20, product: null },
      ]);
    });

    it('saveFavoriteShopIds は残す店の商品を保持する', () => {
      seed([
        { shopId: 1, product: 'いも天' },
        { shopId: 2, product: null },
      ]);
      saveFavoriteShopIds([1]);
      expect(storedEntries()).toEqual([{ shopId: 1, product: 'いも天' }]);
    });

    it('saveFavoriteShopIds は不正な値を捨てる', () => {
      // @ts-expect-error 実行時の不正入力を確認する
      saveFavoriteShopIds([1, '2', 'abc']);
      expect(storedEntries()).toEqual([
        { shopId: 1, product: null },
        { shopId: 2, product: null },
      ]);
    });

    it('toggleFavoriteShopId は未登録なら追加する', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([1, 2]));
      expect(toggleFavoriteShopId(3)).toEqual([1, 2, 3]);
      expect(loadFavoriteShopIds()).toEqual([1, 2, 3]);
    });

    it('toggleFavoriteShopId は登録済みなら削除する', () => {
      localStorage.setItem(FAVORITE_SHOPS_KEY, JSON.stringify([1, 2, 3]));
      expect(toggleFavoriteShopId(2)).toEqual([1, 3]);
      expect(loadFavoriteShopIds()).toEqual([1, 3]);
    });

    it('toggleFavoriteShopId は空の状態からでも動く', () => {
      expect(toggleFavoriteShopId(100)).toEqual([100]);
      expect(loadFavoriteShopIds()).toEqual([100]);
    });
  });
});
