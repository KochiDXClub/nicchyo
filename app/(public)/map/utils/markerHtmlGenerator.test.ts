import { describe, expect, it } from 'vitest';
import { generateShopMarkerHtml, sanitizeCssColor, toCssUrl } from './markerHtmlGenerator';
import type { Shop } from '../data/shops';
import { getShopCategoryColor } from '../config/shopCategories';

describe('sanitizeCssColor', () => {
  it('#RRGGBB を通す', () => {
    expect(sanitizeCssColor('#7ED957')).toBe('#7ED957');
  });
  it('#RGB は 6 桁に展開する', () => {
    expect(sanitizeCssColor('#abc')).toBe('#aabbcc');
  });
  it.each(['red', '#12345', '#7ED957; background:url(x)', 'url(x)', '', undefined])(
    '不正値 %s は undefined',
    (input) => {
      expect(sanitizeCssColor(input)).toBeUndefined();
    }
  );
});

describe('toCssUrl', () => {
  it('サイト内パスと https を引用符付き url() にする', () => {
    expect(toCssUrl('/images/a.png')).toBe('url("/images/a.png")');
    expect(toCssUrl('https://x.supabase.co/storage/v1/object/public/a.png')).toBe(
      'url("https://x.supabase.co/storage/v1/object/public/a.png")'
    );
  });
  it('url() を脱出する文字を除去する', () => {
    expect(toCssUrl('/a.png\\");background:url(evil')).toBe('url("/a.png;background:urlevil")');
  });
  it.each(['javascript:alert(1)', 'http://example.com/a.png', '//evil.example/a.png', 'data:image/png;base64,AAA', ''])(
    '許可外 %s は undefined',
    (input) => {
      expect(toCssUrl(input)).toBeUndefined();
    }
  );
});

describe('generateShopMarkerHtml', () => {
  const baseShop = { id: 1, name: 'テスト', category: '野菜' } as unknown as Shop;

  it('不正な color はカテゴリ色にフォールバックする', () => {
    const html = generateShopMarkerHtml(
      { ...baseShop, illustration: { type: 'tent', color: 'red;x:url(evil)' } } as Shop,
      { illustrationSize: 'medium', includeNameplate: false }
    );
    expect(html).not.toContain('url(evil)');
    expect(html).toContain(`--stall-color:${getShopCategoryColor('野菜')};`);
  });

  it('標準の屋台は 1 つの inline SVG で描く（div の積み重ねにしない）', () => {
    const html = generateShopMarkerHtml(baseShop, {
      illustrationSize: 'medium',
      includeNameplate: false,
    });
    expect(html).toContain('<svg class="shop-illustration shop-illustration-svg"');
    expect(html).toContain('class="stall-roof"');
    expect(html).toContain('class="stall-awning stall-awning-base"');
    expect(html).not.toContain('shop-illustration-3d');
    expect(html).not.toContain('<div class="stall-roof"');
  });

  it('屋根とひさしはカタログから選べ、未知の値は既定に戻る', () => {
    const flat = generateShopMarkerHtml(
      { ...baseShop, illustration: { roof: 'flat', awning: 'plain' } } as Shop,
      { illustrationSize: 'medium', includeNameplate: false }
    );
    expect(flat).not.toContain('skewX(-12)');
    expect(flat).not.toContain('stall-awning-stripe');

    const bogus = generateShopMarkerHtml(
      { ...baseShop, illustration: { roof: 'dome', awning: 'zigzag' } } as unknown as Shop,
      { illustrationSize: 'medium', includeNameplate: false }
    );
    expect(bogus).toContain('skewX(-12)');
    expect(bogus).toContain('stall-awning-stripe');
  });

  it('不正な bannerImage はアイコンごと出さない', () => {
    const html = generateShopMarkerHtml(baseShop, {
      bannerImage: 'javascript:alert(1)',
      illustrationSize: 'medium',
      includeNameplate: false,
    });
    expect(html).not.toContain('shop-product-icon');
  });

  it('正常な bannerImage は引用符付き url() で出す', () => {
    const html = generateShopMarkerHtml(baseShop, {
      bannerImage: '/images/a.png',
      illustrationSize: 'medium',
      includeNameplate: false,
    });
    expect(html).toContain('background-image: url(&quot;/images/a.png&quot;)');
  });
});
