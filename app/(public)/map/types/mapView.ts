/**
 * マップ本体（MapView）の props
 *
 * 描画ライブラリ（Leaflet 版 components/MapView.tsx / MapLibre 版 components/maplibre/MapViewMapLibre.tsx）
 * のどちらからも参照するため、特定のライブラリのファイルに置かずここで定義する。
 */

import type { ReactNode } from "react";
import type { Shop } from "../data/shops";
import type { Landmark } from "./landmark";
import type { MapRoute } from "./mapRoute";
import type { MapCamera } from "./mapCamera";
import type { MapFeatureFlags } from "@/lib/mapFeatureFlags";
import type { MapViewSettings } from "@/lib/map/mapViewSettings";
import type { MapSpot } from "@/lib/spots";

export type MapViewProps = {
  shops?: Shop[];
  landmarks?: Landmark[];
  mapRoute?: MapRoute;
  initialShopId?: number;
  openInitialShopBanner?: boolean;
  searchShopIds?: number[];
  /** 地図が描き終えた（ローディングを畳んでよい） */
  onMapReady?: () => void;
  /** 読み込みの途中経過。ローディングのゲージに使う（MapLibre 版のみ報告する） */
  onMapStage?: (stage: "style" | "loaded") => void;
  eventTargets?: Array<{ id: string; lat: number; lng: number }>;
  highlightEventTargets?: boolean;
  /** 地図のカメラ操作（Leaflet 版は L.Map をそのまま渡す。MapLibre 版はアダプタ） */
  onMapInstance?: (map: MapCamera) => void;
  onUserLocationUpdate?: (coords: { lat: number; lng: number; inMarket: boolean }) => void;
  aiShopIds?: number[];
  commentShopId?: number;
  onZoomChange?: (zoom: number) => void;
  suppressInitialLocationFocus?: boolean;
  /** 管理画面で保存したマップ動作フラグ。URL の ?mapFlags= がクライアント側で上書きする */
  featureFlags?: MapFeatureFlags;
  /**
   * 管理画面「マップの表示範囲」で保存した可動範囲。
   * 効くのは MapLibre 版だけ。Leaflet 版は従来どおり「道の範囲＋可視距離」の
   * 狭い枠のままにしてある（既定の描画の操作感まで黙って変えないため）。
   */
  mapViewSettings?: MapViewSettings;
  onShopSelect?: (shop: Shop) => void;
  /**
   * 電停・駅・建物などのランドマークがタップされたときに呼ばれる。
   * 店舗以外のスポットは親（MapPageClient）が SpotCard で表示する。
   */
  onSpotSelect?: (spot: MapSpot) => void;
  /** 店舗バナーの「ここへ案内」。おでかけサポートでその店への道案内を始める */
  onNavigateToShop?: (shop: Shop) => void;
  /** おでかけサポートで案内中の目的地の店。屋台マーカーを「選択中」の見た目にする */
  guideTargetShopId?: number;
  /** 選択中のスポットID（MapSpot.id）。該当するランドマークを少し大きく表示する */
  selectedSpotId?: string;
  spotlightShopId?: number;
  onClearSearch?: () => void;
  /** マップ座標系内にレンダリングするオーバーレイ（キャラクターなど） */
  overlaySlot?: ReactNode;
  /** trueのとき拡大縮小スライダーと検索バーを非表示にする */
  hideMapUI?: boolean;
  /**
   * trueのとき、通常のランドマーク（駅・電停の常時表示分を含む）を
   * 一切表示しない。おでかけサポートの案内中は FacilityLayer が
   * 同じ電停・駅をカテゴリの目的に合わせて表示するため、両方出すと
   * 二重に見えてしまう／無関係なカテゴリでも常に駅アイコンが写り込む
   * ことになるのを避ける。
   */
  suppressLandmarks?: boolean;
  /**
   * 外から店舗の詳細バナーを開く要求。マーカーをタップしたときと同じ状態にする。
   * 同じ店を続けてタップしても開き直せるよう、id ではなく token の変化で発火させる。
   * ShopScanCards のカードをタップしたときに使う。
   */
  focusShopRequest?: { shopId: number; token: number } | null;
  /** 現在地ボタンの top 位置（px）。検索エリアの実際の高さに合わせて親から渡す */
  trackingButtonTop?: number;
  /**
   * 2本指の回転/ピンチジェスチャー中かどうかが変化したときに呼ばれる。
   * 回転のみのジェスチャーは Leaflet の pan/zoom を伴わないため
   * move/zoom イベントが発火せず、「このへん」ボタンの静止判定
   * （useNearbyPromptVisibility）だけではジェスチャー中を検知できない。
   * この通知を使って親側で表示状態を更新する。
   */
  onGestureActiveChange?: (active: boolean) => void;
};

export type ShopBannerOrigin = { x: number; y: number; width: number; height: number };
