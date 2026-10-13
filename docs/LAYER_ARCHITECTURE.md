# マップのレイヤー構造と座標系

マップの重なり順と、座標の基準をまとめる。マーカーの中身は [ARCHITECTURE_SHOP_MARKERS.md](./ARCHITECTURE_SHOP_MARKERS.md)、見せ方の方針は [MAP_MARKER_DESIGN.md](./MAP_MARKER_DESIGN.md)。

## 描画ライブラリは2系統

`lib/mapFeatureFlags.ts` の `renderer`（既定 `maplibre`。管理画面の設定、または URL の `?mapFlags=renderer:maplibre`）で切り替わる。`MapPageClient.tsx` がどちらの `MapView` を使うか決める。

| | Leaflet 版（既定） | MapLibre 版（移行中の並走検証用） |
|---|---|---|
| 本体 | `components/MapView.tsx`（`react-leaflet`） | `components/maplibre/MapViewMapLibre.tsx`（`maplibre-gl`） |
| 店舗 | DOM マーカー（`OptimizedShopLayerWithClustering`） | GeoJSON シンボルレイヤー（`maplibre/shopFeatures.ts`、スプライトは `stallSprites.ts`） |
| 背景地図 | CARTO ラスタータイル | `basemap` フラグで CARTO ラスター / OpenFreeMap ベクター（`config/basemap.ts`） |
| 道 | `RoadOverlay.tsx` | GeoJSON の `nicchyo-road-*` レイヤー |
| 現在地 | `UserLocationMarker.tsx` | `maplibre/useMapLibreUserLocation.ts` |
| 人影（`crowd`） | なし | `maplibre/crowdSprites.ts`（既定オフ） |

運営の配置編集画面（`app/(public)/map-edit/v3/`）は MapLibre 版のキャンバス（`MapEditCanvasMapLibre.tsx`）を使う。

## Leaflet 版の重なり順（下から）

```
Layer 0: 背景地図              TileLayer（zIndex 1、ズームで不透明度を変える）
Layer 1: 背景オーバーレイ      BackgroundOverlay（market-tint.webp の ImageOverlay。backgroundOverlay フラグ）
Layer 2: 道                    RoadOverlay（config.zIndex = 50）
         ランドマーク          ペイン "landmarks"（70）
Layer 3: 店舗                  ペイン "shop"（610）… OptimizedShopLayerWithClustering
                               ChomeAreaMarkers（丁目バッジ）、GuideLayer（おでかけサポート）、UserLocationMarker
         演出                  "event-dim"（800）、"major-place-label"（950）、"event-glow"（2000）
Layer 4: UI                    地図の外側（MapContainer の外）。ShopDetailBanner、NavigationBar など
```

ペインの z-index は `MapOverlays.tsx` と `OptimizedShopLayerWithClustering.tsx` が正。グローバル UI（メニューなど）の z-index は [MOBILE_VIEWPORT_OPTIMIZATION.md](./MOBILE_VIEWPORT_OPTIMIZATION.md)。

## 座標の基準（Single Source of Truth）

道の座標が、店舗配置・初期表示範囲・ズーム境界などすべての基準。定義は `app/(public)/map/config/roadConfig.ts`。

- `ROAD_CONFIG`: 道の範囲（`bounds`）、中心線（`centerLine`）、幅（`widthOffset`）、東西に並ぶ区間（`segments`、F0〜D7）。種別は `type: 'curved'`
- 道の形そのものは DB（`services/mapRouteDb.ts`）の `MapRoute` があればそちらが優先され、無ければ `getFallbackMapRoute()`
- 取得関数: `getRoadBounds` / `getRoadCenterLine` / `getRoadWidthOffset` / `getRoadLength` / `getRecommendedZoomBounds` / `getNearestPointOnRoad` / `getRoadSide`（北側・南側の判定。店舗データに `side` は無く、ここから導く）
- 会場内外の判定は `isInsideSundayMarket()`（`SUNDAY_MARKET_LOCATION_BOUNDS`）

座標の流れ: 実世界の緯度経度 → 道（`ROAD_CONFIG`）→ 店舗（`shop.lat` / `shop.lng`）→ マーカー。
Leaflet 版では DivIcon の DOM がそのまま当たり判定になるので、描画と当たり判定は別に持たない。

## 店舗の重なり対策

- 店舗が重なるのは、店舗間隔（道に沿って約 67px、zoom 20.5 での実測）より屋台が大きいため。表示の段階（`dot` / `stall` / `photo` / `nameplate`）を絞ることで、そのズームで必要な情報だけを出す（[MAP_MARKER_DESIGN.md](./MAP_MARKER_DESIGN.md)）
- 木札は北側の店は北、南側の店は南へ逃がす（`getRoadSide`）
- 店舗間隔の目安は `SPACING_CONFIG.minPixelsPerShop`（80px。`config/displayConfig.ts`）。`utils/zoomCalculator.ts` はこれを使って初期ズームなどを計算する関数群（`calculateOptimalInitialZoom` ほか）を持つが、`filterShopsByZoom` による店舗の間引きは現在の `MapView` では使っていない

## 背景オーバーレイを変えるとき

見た目は `scripts/build-market-tint.mjs` の SVG を編集してスクリプトを実行し直し、`public/images/maps/market-tint.webp` を作り直す。`BackgroundOverlay.tsx` の `MARKET_TINT_SVG`（比較実験用の SVG 版）も同じ内容にそろえる。範囲は `BackgroundOverlay.tsx` の `MARKET_BOUNDS`。
