import { Shop } from '../data/shops';
import { ILLUSTRATION_SIZES } from '../config/displayConfig';
import { resolveStallColors } from '../config/shopCategories';
import { sanitizeInlineSvg } from './svgSanitizer';

type ShopIllustrationSize = 'small' | 'medium' | 'large';

function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * CSS の color 文脈に入れてよい値だけを通す（#RGB / #RRGGBB）。
 * 出店者編集由来の値が `red; background:url(...)` のような CSS 断片になるのを防ぐ。
 * #RGB は adjustColor が 6 桁前提なので 6 桁に展開する。
 */
export function sanitizeCssColor(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(trimmed);
  if (short) {
    const [, r, g, b] = short;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return undefined;
}

/**
 * CSS の `url()` に入れてよい画像 URL だけを通し、引用符付きで返す。
 * - 許可: サイト内の絶対パス（`/...`、`//` は除く）と https:// のみ
 * - `"` `\` `(` `)` 改行など url() を脱出しうる文字は除去する
 */
export function toCssUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  const isSitePath = trimmed.startsWith('/') && !trimmed.startsWith('//');
  const isHttps = /^https:\/\//i.test(trimmed);
  if (!isSitePath && !isHttps) return undefined;
  const cleaned = trimmed.replace(/["'\()\s]/g, '');
  if (!cleaned) return undefined;
  return `url("${cleaned}")`;
}

function generateShopIllustrationHtml(
  type: 'tent' | 'stall' | 'custom' = 'tent',
  size: ShopIllustrationSize = 'medium',
  customSvg?: string
): string {
  const safeSvg = sanitizeInlineSvg(customSvg);
  if (safeSvg) {
    return `<div class="shop-illustration">${safeSvg}</div>`;
  }

  if (type === 'custom') {
    return '';
  }

  // DivIcon の iconSize と同じ値を使う（ILLUSTRATION_SIZES が唯一の正）。
  const { width, height } = ILLUSTRATION_SIZES[size];

  return `
    <div
      class="shop-illustration shop-illustration-3d"
      style="width:${width}px;height:${height}px;"
    >
      <div class="stall-shadow" aria-hidden="true"></div>
      <div class="stall-roof" aria-hidden="true"></div>
      <div class="stall-awning" aria-hidden="true"></div>
      <div class="stall-body" aria-hidden="true"></div>
      <div class="stall-counter" aria-hidden="true"></div>
      <div class="stall-legs" aria-hidden="true"></div>
    </div>
  `;
}

export interface ShopMarkerHtmlOptions {
  /** 屋根の上に載せる写真。無ければアイコンごと出さない */
  bannerImage?: string;
  illustrationSize: ShopIllustrationSize;
  /** 木札（店名）の DOM を含めるか。LOD が nameplate のときだけ true */
  includeNameplate: boolean;
}

export function generateShopMarkerHtml(
  shop: Shop,
  { bannerImage, illustrationSize, includeNameplate }: ShopMarkerHtmlOptions
): string {
  // 屋台の色はカテゴリで決まる。状態色（選択/AI/検索/買い物袋）は
  // CSS 側が上書きするので、ここではカテゴリ色だけを渡す。
  const stall = resolveStallColors(shop.category, sanitizeCssColor(shop.illustration?.color));
  const colorStyle =
    `--stall-color:${stall.base};` +
    `--stall-color-dark:${stall.dark};` +
    `--stall-color-light:${stall.light};`;

  const bannerCssUrl = toCssUrl(bannerImage);
  const productIconHtml = bannerCssUrl
    ? `<span class="shop-product-icon" style="background-image: ${escapeHtml(bannerCssUrl)}" aria-hidden="true"></span>`
    : '';

  const nameplateHtml = includeNameplate
    ? `<div class="shop-nameplate"><span class="shop-nameplate-text">${escapeHtml(shop.name)}</span></div>`
    : '';

  const illustrationHtml = generateShopIllustrationHtml(
    shop.illustration?.type,
    illustrationSize,
    shop.illustration?.customSvg
  );

  return `
    <div class="shop-marker-container" style="${colorStyle}">
      ${productIconHtml}
      <div class="shop-favorite-badge" aria-hidden="true">&#10084;</div>
      <div class="shop-bag-badge" aria-hidden="true">🛍️</div>
      ${illustrationHtml}
      ${nameplateHtml}
    </div>
  `;
}
