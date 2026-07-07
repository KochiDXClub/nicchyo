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
export const SKIPPED_ZOOM_NUDGE = 0.03;
