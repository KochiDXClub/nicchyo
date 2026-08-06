import { describe, it, expect } from 'vitest';
import {
  SHOP_CATEGORY_NAMES,
  SHOP_CATEGORY_COLORS,
  DEFAULT_SHOP_CATEGORY_COLOR,
  getShopCategoryColor,
  adjustColor,
  resolveStallColors,
} from './shopCategories';

describe('getShopCategoryColor', () => {
  it('7カテゴリすべてが専用の色を返す', () => {
    for (const name of SHOP_CATEGORY_NAMES) {
      expect(getShopCategoryColor(name)).toBe(SHOP_CATEGORY_COLORS[name]);
    }
  });

  it('7カテゴリの色はすべて異なる', () => {
    const colors = Object.values(SHOP_CATEGORY_COLORS);
    expect(new Set(colors).size).toBe(colors.length);
  });

  it('未知のカテゴリはデフォルト色を返す', () => {
    expect(getShopCategoryColor('存在しないカテゴリ')).toBe(DEFAULT_SHOP_CATEGORY_COLOR);
  });

  it('null / undefined / 空文字はデフォルト色を返す', () => {
    expect(getShopCategoryColor(null)).toBe(DEFAULT_SHOP_CATEGORY_COLOR);
    expect(getShopCategoryColor(undefined)).toBe(DEFAULT_SHOP_CATEGORY_COLOR);
    expect(getShopCategoryColor('')).toBe(DEFAULT_SHOP_CATEGORY_COLOR);
  });
});

describe('adjustColor', () => {
  it('明度を上げ下げする', () => {
    expect(adjustColor('#808080', 16)).toBe('#909090');
    expect(adjustColor('#808080', -16)).toBe('#707070');
  });

  it('先頭の # がなくても扱える', () => {
    expect(adjustColor('808080', 16)).toBe('#909090');
  });

  it('下限をクランプする', () => {
    expect(adjustColor('#000000', -25)).toBe('#000000');
  });

  it('上限をクランプする', () => {
    expect(adjustColor('#ffffff', 25)).toBe('#ffffff');
  });

  it('常に6桁になるようゼロ埋めする', () => {
    expect(adjustColor('#000000', 1)).toBe('#010101');
  });
});

describe('resolveStallColors', () => {
  it('カテゴリ色から light / dark を導出する', () => {
    const colors = resolveStallColors('食材');
    expect(colors.base).toBe(SHOP_CATEGORY_COLORS['食材']);
    expect(colors.dark).toBe(adjustColor(colors.base, -25));
    expect(colors.light).toBe(adjustColor(colors.base, 25));
  });

  it('出店者の個別指定がカテゴリ色より優先される', () => {
    const colors = resolveStallColors('食材', '#123456');
    expect(colors.base).toBe('#123456');
  });

  it('個別指定が空文字ならカテゴリ色にフォールバックする', () => {
    expect(resolveStallColors('食材', '').base).toBe(SHOP_CATEGORY_COLORS['食材']);
  });

  it('カテゴリも指定もなければデフォルト色になる', () => {
    expect(resolveStallColors().base).toBe(DEFAULT_SHOP_CATEGORY_COLOR);
  });
});
