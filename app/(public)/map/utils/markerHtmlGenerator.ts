import { Shop } from '../data/shops';
import { ILLUSTRATION_SIZES } from '../config/displayConfig';
import { resolveStallColors } from '../config/shopCategories';
import { sanitizeInlineSvg } from './svgSanitizer';
import { generateStallSvg, resolveStallParts } from '../config/stallParts';

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
  const cleaned = trimmed.replace(/["'\\()\s]/g, '');
  if (!cleaned) return undefined;
  return `url("${cleaned}")`;
}

export type StallRendererOption = 'svg' | 'div';

/**
 * 屋台イラスト。
 * - svg（既定）: config/stallParts.ts のカタログから 1 つの inline SVG として描く
 * - div: div を 6 個積んで CSS で形を作る従来方式（比較実験用。globals.css の .shop-illustration-3d）
 * 出店者のカスタム SVG がある場合はどちらでもそれを優先する。
 */
function generateShopIllustrationHtml(
  illustration: Shop['illustration'],
  size: ShopIllustrationSize = 'medium',
  renderer: StallRendererOption = 'svg'
): string {
  const safeSvg = sanitizeInlineSvg(illustration?.customSvg);
  if (safeSvg) {
    return `<div class="shop-illustration">${safeSvg}</div>`;
  }

  if (illustration?.type === 'custom') {
    return '';
  }

  // DivIcon の iconSize と同じ値を使う（ILLUSTRATION_SIZES が唯一の正）。
  const { width, height } = ILLUSTRATION_SIZES[size];

  if (renderer === 'div') {
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

  const parts = resolveStallParts({ roof: illustration?.roof, awning: illustration?.awning });
  return generateStallSvg(parts, { width, height });
}

export interface ShopMarkerHtmlOptions {
  /** 屋根の上に載せる写真。無ければアイコンごと出さない */
  bannerImage?: string;
  illustrationSize: ShopIllustrationSize;
  /** 木札（店名）の DOM を含めるか。LOD が nameplate のときだけ true */
  includeNameplate: boolean;
  /** 屋台の描画方式（lib/mapFeatureFlags.ts の stallRenderer）。既定は svg */
  stallRenderer?: StallRendererOption;
}

/**
 * お気に入りの印。
 *
 * かつては ❤（U+2764）の文字をそのまま置いていたが、端末ごとに絵文字の
 * 絵柄が変わって揃わない（`NavigationBar` と同じ理由）。線と塗りを自分で
 * 持つ SVG に替えて、どの端末でも同じ形にする。
 *
 * 色は tailwind.config.js / globals.css に定義済みのお気に入り色
 * （--favorite-fg）。枠と影は木札（.shop-nameplate）と同じ family にして、
 * 日曜市の木の看板が並ぶ世界から浮かないようにしている。
 */
export const SHOP_FAVORITE_BADGE_HTML = `<div class="shop-favorite-badge" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg></div>`;

export function generateShopMarkerHtml(
  shop: Shop,
  { bannerImage, illustrationSize, includeNameplate, stallRenderer = 'svg' }: ShopMarkerHtmlOptions
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

  const illustrationHtml = generateShopIllustrationHtml(shop.illustration, illustrationSize, stallRenderer);

  return `
    <div class="shop-marker-container" style="${colorStyle}">
      ${productIconHtml}
      ${SHOP_FAVORITE_BADGE_HTML}
      ${illustrationHtml}
      ${nameplateHtml}
    </div>
  `;
}
