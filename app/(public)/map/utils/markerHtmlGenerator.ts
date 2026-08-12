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
  const stall = resolveStallColors(shop.category, shop.illustration?.color);
  const colorStyle =
    `--stall-color:${stall.base};` +
    `--stall-color-dark:${stall.dark};` +
    `--stall-color-light:${stall.light};`;

  const productIconHtml = bannerImage
    ? `<span class="shop-product-icon" style="background-image: url(${escapeHtml(bannerImage)})" aria-hidden="true"></span>`
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
      <div class="shop-recipe-icons" aria-hidden="true"></div>
      <div class="shop-kotodute-badge" aria-hidden="true">i</div>
      <div class="shop-favorite-badge" aria-hidden="true">&#10084;</div>
      <div class="shop-bag-badge" aria-hidden="true">🛍️</div>
      ${illustrationHtml}
      ${nameplateHtml}
    </div>
  `;
}
