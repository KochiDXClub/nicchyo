import { describe, it, expect } from 'vitest';
import { getShopBannerImage, getShopPreviewImage, getShopThumbnailImage } from './shopImages';

describe('getShopBannerImage', () => {
  // Constants from the source file for verification
  // Note: We are testing public API behavior, but knowing expected values helps.
  const DEFAULT_BANNER = "/images/shops/tosahamono.webp";
  const INGREDIENT_IMAGES = ["/images/shops/ninjin.webp", "/images/shops/retasu.webp"];

  describe('Edge Cases (Empty or Invalid Input)', () => {
    it('returns the default banner when category is null', () => {
      const result = getShopBannerImage(null);
      expect(result).toBe(DEFAULT_BANNER);
    });

    it('returns the default banner when category is undefined', () => {
      const result = getShopBannerImage(undefined);
      expect(result).toBe(DEFAULT_BANNER);
    });

    it('returns the default banner when category is unknown', () => {
      const result = getShopBannerImage('Unknown Category');
      expect(result).toBe(DEFAULT_BANNER);
    });
  });

  describe('Valid Input (Known Categories)', () => {
    it('returns a valid image for "食材" category', () => {
      const result = getShopBannerImage('食材');
      expect(INGREDIENT_IMAGES).toContain(result);
    });

    it('returns a valid image for "生活雑貨" category', () => {
      const GOODS_IMAGES = [
        "/images/shops/takekago.webp",
        "/images/shops/dish.webp",
        "/images/shops/towel.webp",
      ];
      const result = getShopBannerImage('生活雑貨');
      expect(GOODS_IMAGES).toContain(result);
    });
  });

  describe('Deterministic Behavior with Seed', () => {
    it('returns the same image for the same numeric seed', () => {
      const category = '食材';
      const seed = 12345;

      const result1 = getShopBannerImage(category, seed);
      const result2 = getShopBannerImage(category, seed);

      expect(result1).toBe(result2);
    });

    it('returns the same image for the same string seed', () => {
      const category = '食材';
      const seed = 'shop-123';

      const result1 = getShopBannerImage(category, seed);
      const result2 = getShopBannerImage(category, seed);

      expect(result1).toBe(result2);
    });

  });
});


describe('getShopPreviewImage', () => {
  const INGREDIENT_IMAGES = ["/images/shops/ninjin.webp", "/images/shops/retasu.webp"];

  describe('登録された写真があるときはそれを使う', () => {
    it('main を最優先する', () => {
      const result = getShopPreviewImage({
        id: 1,
        position: 2,
        category: '食材',
        images: { main: '/main.webp', thumbnail: '/thumb.webp', additional: ['/extra.webp'] },
      });
      expect(result).toBe('/main.webp');
    });

    it('main が無ければ thumbnail を使う（以前は相談画面だけ既定画像になっていた）', () => {
      const result = getShopPreviewImage({
        id: 1,
        position: 2,
        category: '食材',
        images: { thumbnail: '/thumb.webp' },
      });
      expect(result).toBe('/thumb.webp');
    });

    it('main も thumbnail も無ければ additional の最初を使う', () => {
      const result = getShopPreviewImage({
        id: 1,
        category: '食材',
        images: { additional: ['/extra.webp', '/extra2.webp'] },
      });
      expect(result).toBe('/extra.webp');
    });

    it('additional の先頭が空でも、埋まっているものを拾う', () => {
      const result = getShopPreviewImage({
        id: 1,
        category: '食材',
        images: { additional: [undefined, '', '/extra2.webp'] },
      });
      expect(result).toBe('/extra2.webp');
    });

    it('空文字は「登録されていない」として扱う', () => {
      const result = getShopPreviewImage({
        id: 1,
        position: 2,
        category: '食材',
        images: { main: '', thumbnail: '' },
      });
      expect(INGREDIENT_IMAGES).toContain(result);
    });
  });

  describe('写真が無いときはカテゴリの既定画像', () => {
    it('種には position を使う（id ではない）', () => {
      // position と id で剰余が変わる組み合わせ。以前は画面ごとに別の写真が出ていた
      const viaPosition = getShopBannerImage('食材', 2);
      const result = getShopPreviewImage({ id: 5, position: 2, category: '食材' });
      expect(result).toBe(viaPosition);
      expect(result).not.toBe(getShopBannerImage('食材', 5));
    });

    it('position が無ければ id にフォールバックする', () => {
      const result = getShopPreviewImage({ id: 5, category: '食材' });
      expect(result).toBe(getShopBannerImage('食材', 5));
    });

    it('position が 0 でも id に落ちない（0 は正当な位置）', () => {
      const result = getShopPreviewImage({ id: 5, position: 0, category: '食材' });
      expect(result).toBe(getShopBannerImage('食材', 0));
    });

    it('同じ店なら何度呼んでも同じ写真になる', () => {
      const shop = { id: 7, position: 3, category: '生活雑貨' };
      expect(getShopPreviewImage(shop)).toBe(getShopPreviewImage(shop));
    });

    it('カテゴリが無い店でも既定のバナーを返す', () => {
      const result = getShopPreviewImage({ id: 1, position: 1 });
      expect(result).toBe("/images/shops/tosahamono.webp");
    });

    it('images そのものが無くても落ちない', () => {
      const result = getShopPreviewImage({ id: 1, position: 1, category: '食材' });
      expect(INGREDIENT_IMAGES).toContain(result);
    });

    it('空のオブジェクトでも既定のバナーを返す', () => {
      // MapPageClient の出店者パネルが、店が見つからないときに {} を渡す
      expect(getShopPreviewImage({})).toBe("/images/shops/tosahamono.webp");
    });
  });
});

describe('getShopThumbnailImage', () => {
  it('thumbnail が指定されていれば最優先で返す', () => {
    const result = getShopThumbnailImage({
      id: 1,
      images: {
        main: 'https://example.supabase.co/storage/v1/object/public/vendor-images/v1/store-main.webp',
        thumbnail: 'https://example.supabase.co/storage/v1/object/public/vendor-images/v1/custom-thumb.webp',
      },
    });
    expect(result).toBe('https://example.supabase.co/storage/v1/object/public/vendor-images/v1/custom-thumb.webp');
  });

  it('store-main.webp のメイン画像がある場合、store-thumb.webp に置き換えて返す', () => {
    const result = getShopThumbnailImage({
      id: 1,
      images: {
        main: 'https://example.supabase.co/storage/v1/object/public/vendor-images/v1/store-main.webp',
      },
    });
    expect(result).toBe('https://example.supabase.co/storage/v1/object/public/vendor-images/v1/store-thumb.webp');
  });

  it('store-main.jpg など異なる拡張子でも store-thumb.webp に変換する', () => {
    const result = getShopThumbnailImage({
      id: 1,
      images: {
        main: 'https://example.supabase.co/storage/v1/object/public/vendor-images/v1/store-main.jpg',
      },
    });
    expect(result).toBe('https://example.supabase.co/storage/v1/object/public/vendor-images/v1/store-thumb.webp');
  });

  it('store-main 以外の一般的な画像URLの場合は getShopPreviewImage にフォールバックする', () => {
    const result = getShopThumbnailImage({
      id: 1,
      images: {
        main: 'https://example.com/banner.png',
      },
    });
    expect(result).toBe('https://example.com/banner.png');
  });

  it('画像が未登録の場合はカテゴリ既定画像を返す', () => {
    const result = getShopThumbnailImage({
      id: 1,
      position: 1,
      category: '生活雑貨',
    });
    expect(result).toBe(getShopPreviewImage({ id: 1, position: 1, category: '生活雑貨' }));
  });
});

