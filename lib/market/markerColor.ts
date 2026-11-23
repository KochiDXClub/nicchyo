/**
 * 市ごとの地図マーカーの色。
 * 日曜市は従来の見た目（出店者のいる区画のオレンジ）のまま、ほかの市は色で見分けられるようにする。
 */

/** 日曜市の色（従来の「出店者のいる区画」の色と同じ） */
export const SUNDAY_MARKET_MARKER_COLOR = "#D97706";

/** 新しい市の初期色（マップ編集の「保存していない変更」の青、空き区画の赤と混ざらない色） */
export const DEFAULT_MARKET_MARKER_COLOR = "#0D9488";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isMarkerColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

/** 値が #RRGGBB でなければ、その市の既定色を返す（色の入力ミスで地図が壊れないように） */
export function resolveMarkerColor(value: unknown, fallback: string = DEFAULT_MARKET_MARKER_COLOR): string {
  return isMarkerColor(value) ? value.toUpperCase() : fallback;
}

type MarkerMarket = { id: string; slug: string; markerColor?: string | null };

/**
 * 区画（道に乗っているもの）の市の色。道を持たない旧区画は日曜市の色。
 * 区画の市は、その区画が乗る道の市で決まる（DB のトリガーと同じ規則）。
 */
export function markerColorForRoad(
  roadMarketId: string | null | undefined,
  markets: readonly MarkerMarket[],
): string {
  const sunday = markets.find((market) => market.slug === "nichiyo");
  const market = roadMarketId ? markets.find((item) => item.id === roadMarketId) : sunday;
  return resolveMarkerColor(market?.markerColor, market?.slug === "nichiyo" || !market ? SUNDAY_MARKET_MARKER_COLOR : DEFAULT_MARKET_MARKER_COLOR);
}
