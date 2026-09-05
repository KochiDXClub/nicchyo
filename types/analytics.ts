export type AnalyticsEventName =
  | "page_view"
  | "shop_impression"
  | "shop_view"
  | "shop_scroll"
  | "add_to_bag"
  | "guide_open"
  | "guide_navigation_start"
  | "guide_arrived"
  | "guide_navigation_stop";

export type VisitorKey = string;

export interface PageViewParams {
  page_path: string;
  page_location?: string;
  page_title?: string;
}

export interface ShopImpressionParams {
  shop_id: string;
  shop_name?: string;
  list_position?: number;
  context?: string;
}

export interface ShopViewParams {
  shop_id: string;
  source?: string;
  interaction_method?: string;
}

export interface ShopScrollParams {
  shop_id: string;
  scroll_area: string;
  scroll_depth: number; // 0..100
  viewport_time?: number;
}

/** おでかけサポートの利用ログ（guide_events） */
export interface GuideEventParams {
  kinds?: string[];
  spot_key?: string | null;
  origin_type?: string | null;
  walk_minutes?: number | null;
  distance_meters?: number | null;
}

export type AnalyticsParams =
  | PageViewParams
  | ShopImpressionParams
  | ShopViewParams
  | ShopScrollParams
  | GuideEventParams
  | Record<string, unknown>;

export interface SendEventOptions {
  toServer?: boolean; // whether to POST to server endpoints for reliable logging
}

export type SendEventFn = (name: AnalyticsEventName, params: AnalyticsParams, options?: SendEventOptions) => void;
