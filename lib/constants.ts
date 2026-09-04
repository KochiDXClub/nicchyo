const DEFAULT_SITE_URL = "https://nicchyo.jp";

/**
 * NEXT_PUBLIC_SITE_URL を正規化する。
 *
 * この値は app/layout.tsx の `metadataBase: new URL(SITE_URL)` でモジュール評価時に
 * 使われるため、不正な値を返すと全ページが500になる。設定ミスがあっても必ず
 * `new URL()` を通せる値を返すこと。
 *
 * - `??` ではなく `||` を使う: "" や "  "（空文字・空白のみ）は null/undefined ではないため
 *   `??` ではフォールバックされず、new URL("") が例外を投げる
 * - 末尾の `/` はフォールバック"前"に剥がす: 後に剥がすと "/" や "///" のような値が
 *   空文字になってフォールバックをすり抜ける（`${SITE_URL}/shops/...` の二重スラッシュ対策も兼ねる）
 * - スキーム無し（"nicchyo.jp"）や http/https 以外は new URL() が投げるか
 *   おかしなURLになるため、実際に new URL() を通して検証してから採用する
 */
export function normalizeSiteUrl(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_SITE_URL;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return DEFAULT_SITE_URL;
    return trimmed;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

// サイトの絶対URL。metadataBase・JSON-LD・sitemapで共通利用する。
export const SITE_URL = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

// クーポン1日の最大発行数（coupon_settings.maxDailyIssuance のデフォルト値）
export const MAX_COUPON_ISSUANCE = 300;

// 管理画面の一括操作で同時に処理できる最大件数
export const MAX_BULK_OPERATION = 200;

// 日曜市の中心座標（高知城前〜追手筋）
export const MARKET_CENTER: [number, number] = [33.55915, 133.531];

// JST 翌日 00:00 を UTC で表す時刻サフィックス（ISO 8601）
// 日本時間は UTC+9 のため、翌日 0:00 JST = 前日 15:00 UTC
export const JST_MIDNIGHT_UTC_SUFFIX = "T15:00:00.000Z";

// マップ拡大時の道路スナップまでの待機時間（ミリ秒）
export const ROAD_SNAP_DELAY_MS = 160;

// スナップ前後の中心点距離がこの値未満なら pan を行わない（メートル）
export const ROAD_SNAP_MIN_DISTANCE_METERS = 12;

// ズーム18付近（丁目表示切替境界）で停止しないようにするための設定
export const SKIPPED_ZOOM_LEVELS = [18] as const;
export const SKIPPED_ZOOM_TOLERANCE = 0.026;
// SKIPPED_ZOOM_NUDGE は SKIPPED_ZOOM_TOLERANCE より大きく保つこと
// （ナッジ後のズームが再びスキップゾーンに入らないようにするため）
export const SKIPPED_ZOOM_NUDGE = 0.03;
