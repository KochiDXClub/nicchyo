export type ExpirationPreset = "1h" | "sunday" | "custom";

export type PostStatus = "active" | "expired" | "scheduled";

export type Post = {
  id: string;
  vendor_id: string;
  text: string;
  image_url?: string;
  created_at: string;
  expiration_time: string;
  status: PostStatus;
  /** ハートリアクション数（content_reactions 集計。取得失敗時は undefined） */
  heartCount?: number;
};

/** 出店者アナリティクス用のハート集計 */
export type HeartSummary = {
  total: number;
  thisWeek: number;
};

export type PaymentMethod = "cash" | "card" | "paypay" | "ic";

export type RainPolicy = "outdoor" | "tent" | "cancel" | "undecided";

export type Store = {
  id: string;
  vendor_id: string;
  name: string;
  owner_name?: string;
  /** 店主名を公開ページに表示するか。既定は非公開。 */
  owner_name_public?: boolean;
  category_id: string;
  style: string;
  style_tags: string[];
  main_products: string[];
  main_product_prices: Record<string, number | null>;
  payment_methods: PaymentMethod[];
  rain_policy: RainPolicy;
  schedule: string[];
  shop_image_url?: string;
  sns_instagram?: string;
  sns_x?: string;
  sns_hp?: string;
  business_hours_start?: string;
  business_hours_end?: string;
  /** バナーのテーマカラー（プリセットキー） */
  theme_color?: "amber" | "green" | "orange" | "earth" | "navy" | "rose";
  /** キャッチコピー（20文字以内） */
  catchphrase?: string;
};

export type VendorAnalytics = {
  thisWeek: { views: number; clicks: number; searchImpressions: number };
  lastWeek: { views: number; clicks: number; searchImpressions: number };
  rank: number;
  totalVendors: number;
};

export type ProductSale = {
  id: string;
  vendor_id: string;
  product_name: string;
  quantity: number;
  sale_date: string;
  created_at: string;
  updated_at: string;
};

export type HourlyData = {
  hour: string;
  views: number;
};

export type MarketTrend = {
  rank: number;
  product_name: string;
  total_quantity: number;
  vendor_count: number;
};

export type SearchSourceRatio = {
  preVisit: number;  // source = "search"（来訪前）
  onSite: number;    // source = "map"（現地）
  other: number;     // source = "direct" など
};

export type SearchKeywordTrend = {
  keyword: string;
  count: number;
  matchesMyProducts: boolean;
};

export type AiConsultTopic = {
  category: string;
  count: number;
};

export type AiKeyword = {
  keyword: string;
  count: number;
};

export type AiConsultAnalytics = {
  topics: AiConsultTopic[];
  keywords: AiKeyword[];
  recommendationCount: number;
  locationRatio: { preVisit: number; onSite: number };
  totalCount: number;
};
