import { Shop } from '../data/shops';
import { ILLUSTRATION_SIZES } from '../config/displayConfig';
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

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function generateShopIllustrationHtml(
  type: 'tent' | 'stall' | 'custom' = 'tent',
  size: ShopIllustrationSize = 'medium',
  color?: string,
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
  // かつて独自の 40/60/80 を持っており、当たり判定と実描画がズレていた。
  const { width, height } = ILLUSTRATION_SIZES[size];
  const baseColor = color || '#22c55e';
  const darkColor = adjustColor(baseColor, -25);
  const lightColor = adjustColor(baseColor, 25);

  const style = `width:${width}px;height:${height}px;--stall-color:${baseColor};--stall-color-dark:${darkColor};--stall-color-light:${lightColor};`;

  return `
    <div
      class="shop-illustration shop-illustration-3d"
      style="${style}"
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

export function generateShopMarkerHtml(
  shop: Shop,
  mode: 'full' | 'mid',
  bannerImage: string | undefined,
  attendanceLabel: string,
  illustrationSize: ShopIllustrationSize,
  _mainProduct: string
): string {
  const bannerHtml = mode === 'full' ? `
    ${bannerImage ? `<span class="shop-product-icon" style="background-image: url(${escapeHtml(bannerImage)})" aria-hidden="true"></span>` : ''}
    <div class="shop-simple-banner" aria-hidden="true">
      <div class="shop-simple-banner-image">
        <img src="${escapeHtml(bannerImage || '')}" alt="" />
      </div>
      <div class="shop-simple-banner-body">
        <div class="shop-simple-banner-name">${escapeHtml(shop.name)}</div>
      </div>
    </div>
  ` : '';

  const illustrationHtml = generateShopIllustrationHtml(
    shop.illustration?.type,
    illustrationSize,
    shop.illustration?.color,
    shop.illustration?.customSvg
  );

  return `
    <div class="shop-marker-container">
      ${bannerHtml}
      <div class="shop-recipe-icons" aria-hidden="true"></div>
      <div class="shop-kotodute-badge" aria-hidden="true">i</div>
      <div class="shop-favorite-badge" aria-hidden="true">&#10084;</div>
      <div class="shop-bag-badge" aria-hidden="true">🛍️</div>
      ${illustrationHtml}
    </div>
  `;
}
