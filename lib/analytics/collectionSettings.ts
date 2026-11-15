/** 計測の保存先ごとの管理設定。既存環境では未設定の項目を有効として扱う。 */
export const ANALYTICS_COLLECTION_ITEMS = [
  { key: "pageVisits", label: "ページ閲覧・訪問者数" },
  { key: "shopViews", label: "店舗詳細の閲覧" },
  { key: "searchLogs", label: "検索キーワード" },
  { key: "guideEvents", label: "おでかけサポート" },
  { key: "consultLogs", label: "AI相談の集計" },
  { key: "consultFeedback", label: "AI相談への評価" },
  { key: "googleAnalytics", label: "Google アナリティクス" },
] as const;

export type AnalyticsCollectionKey = (typeof ANALYTICS_COLLECTION_ITEMS)[number]["key"];
export type AnalyticsCollectionSettings = Record<AnalyticsCollectionKey, boolean>;

export function parseAnalyticsCollectionSettings(value: unknown): AnalyticsCollectionSettings {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return Object.fromEntries(ANALYTICS_COLLECTION_ITEMS.map(({ key }) => [key, typeof record[key] === "boolean" ? record[key] : true])) as AnalyticsCollectionSettings;
}
