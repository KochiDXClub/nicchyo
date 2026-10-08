/**
 * 店舗カテゴリの表示設定
 *
 * カテゴリ名の正はこのファイル。data/shops.ts はここから再エクスポートする。
 */

export const SHOP_CATEGORY_NAMES = [
  '食材',
  '食べ物',
  '道具・工具',
  '生活雑貨',
  '植物・苗',
  'アクセサリー',
  '手作り・工芸',
] as const;

export type ShopCategory = (typeof SHOP_CATEGORY_NAMES)[number];

/**
 * 屋台イラストのカテゴリ別ベースカラー。
 *
 * サイトの amber / orange 基調に合わせ、彩度を抑えた暖色寄りで統一している。
 * 色相は隣り合っても弁別できるよう分散させつつ、明度を揃えることで
 * 「どれか1色だけが目立つ」ことがないようにしている
 * （docs/map-spec.md「情報の詰め込みすぎを避ける」）。
 */
export const SHOP_CATEGORY_COLORS: Record<ShopCategory, string> = {
  '食材': '#5FA86B', // あさぎ緑
  '食べ物': '#E08A3C', // 柿色
  '道具・工具': '#6B7F9E', // 藍鼠
  '生活雑貨': '#9384B8', // 藤
  '植物・苗': '#4FA58F', // 若竹
  'アクセサリー': '#D97A9A', // 撫子
  '手作り・工芸': '#C29144', // 黄土
};

/** カテゴリ未設定・未知カテゴリの色（暖色寄りニュートラル） */
export const DEFAULT_SHOP_CATEGORY_COLOR = '#B08B5E';

export function getShopCategoryColor(category?: string | null): string {
  if (!category) return DEFAULT_SHOP_CATEGORY_COLOR;
  return SHOP_CATEGORY_COLORS[category as ShopCategory] ?? DEFAULT_SHOP_CATEGORY_COLOR;
}

/**
 * #rrggbb を明度方向にずらす（屋根のハイライト・影の生成用）。
 * 範囲外はクランプする。
 */
export function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export interface StallColors {
  base: string;
  dark: string;
  light: string;
}

/**
 * 屋台の3色セットを解決する。
 *
 * 優先順位: 出店者の個別指定（DB） > カテゴリ色 > デフォルト
 *
 * なお現状 shop.illustration は shopDb.ts / API のどちらからも供給されていないため、
 * overrideColor は常に undefined で、実質すべての店舗がカテゴリ色で描画される。
 * 将来の出店者カスタマイズ（types/shopData.ts「カスタムカラー（運営承認が必要）」）
 * の入口として分岐を残している。
 */
export function resolveStallColors(
  category?: string | null,
  overrideColor?: string
): StallColors {
  const base = overrideColor || getShopCategoryColor(category);
  return {
    base,
    dark: adjustColor(base, -25),
    light: adjustColor(base, 25),
  };
}
