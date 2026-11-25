# マップのレイヤー構造と座標系

マップの重なり順と、座標の基準をまとめる。マーカーの中身は [ARCHITECTURE_SHOP_MARKERS.md](./ARCHITECTURE_SHOP_MARKERS.md)、見せ方の方針は [MAP_MARKER_DESIGN.md](./MAP_MARKER_DESIGN.md)。

## 描画ライブラリは MapLibre 版のみ

マップ本体は `components/maplibre/MapViewMapLibre.tsx`（`maplibre-gl`）だけ。`MapPageClient.tsx` が SSR 無効の `dynamic import` で読み込む。

以前は Leaflet 版（`react-leaflet`）と並走していたが、MapLibre 版に一本化して Leaflet 版のコンポーネントは削除した。`lib/mapFeatureFlags.ts` に `renderer` フラグは無い。

| 要素 | 実装（MapLibre 版） |
|---|---|
| 本体 | `components/maplibre/MapViewMapLibre.tsx` |
| 店舗 | GeoJSON シンボルレイヤー（`maplibre/shopFeatures.ts`、スプライトは `stallSprites.ts`） |
| 背景地図 | `basemap` フラグで CARTO ラスター / OpenFreeMap ベクター（`config/basemap.ts`） |
| 背景の色かぶせ | `nicchyo-tint`（ラスター画像ソース） |
| 道 | GeoJSON の `nicchyo-road-*` レイヤー（色・線幅は `config/roadStyle.ts`） |
| ランドマーク | `nicchyo-landmarks*` レイヤー |
| 現在地 | `maplibre/useMapLibreUserLocation.ts` |
| 人影（`crowd`） | `maplibre/crowdSprites.ts`（既定オフ） |
| おでかけサポート | `GuideLayer.tsx`（maplibregl.Marker と GeoJSON の線） |

運営の配置編集画面（`app/(public)/map-edit/v3/`）も MapLibre 版のキャンバス（`MapEditCanvasMapLibre.tsx`）を使う。

## 重なり順

`MapViewMapLibre.tsx` の `addLayer` は呼ばれた順に積まれる（後に追加したものが上）。下から大づかみに次のとおり。

```
背景地図           ベースマップ（ラスター / ベクター）
背景の色かぶせ      nicchyo-tint
道                  nicchyo-road-*（fill → corridor → lane → overview-tint → edges）
ランドマーク        nicchyo-landmarks*
店舗                シンボルレイヤー（shopFeatures.ts）
おでかけサポート・現在地などの重ね
UI                  地図の外側（MapContainer の外）。ShopDetailBanner、NavigationBar など
```

グローバル UI（メニューなど）の z-index は [MOBILE_VIEWPORT_OPTIMIZATION.md](./MOBILE_VIEWPORT_OPTIMIZATION.md)。

## 座標の基準（Single Source of Truth）

道の座標が、店舗配置・初期表示範囲・ズーム境界などすべての基準。定義は `app/(public)/map/config/roadConfig.ts`。

- `ROAD_CONFIG`: 道の範囲（`bounds`）、中心線（`centerLine`）、幅（`widthOffset`）、東西に並ぶ区間（`segments`、F0〜D7）。種別は `type: 'curved'`
- 道の形そのものは DB（`services/mapRouteDb.ts`）の `MapRoute` があればそちらが優先され、無ければ `getFallbackMapRoute()`
- 取得関数: `getRoadBounds` / `getRoadCenterLine` / `getRoadWidthOffset` / `getRoadLength` / `getRecommendedZoomBounds` / `getNearestPointOnRoad` / `getRoadSide`（北側・南側の判定。店舗データに `side` は無く、ここから導く）
- 会場内外の判定は `isInsideSundayMarket()`（`SUNDAY_MARKET_LOCATION_BOUNDS`）

座標の流れ: 実世界の緯度経度 → 道（`ROAD_CONFIG`）→ 店舗（`shop.lat` / `shop.lng`）→ マーカー。

## 店舗の重なり対策

- 店舗が重なるのは、店舗間隔（道に沿って約 67px、zoom 20.5 での実測）より屋台が大きいため。表示の段階（`dot` / `stall` / `photo` / `nameplate`）を絞ることで、そのズームで必要な情報だけを出す（[MAP_MARKER_DESIGN.md](./MAP_MARKER_DESIGN.md)）
- 木札は北側の店は北、南側の店は南へ逃がす（`getRoadSide`）
- 店舗間隔の目安は `SPACING_CONFIG.minPixelsPerShop`（80px。`config/displayConfig.ts`）。`utils/zoomCalculator.ts` はこれを使って初期ズームなどを計算する関数群（`calculateOptimalInitialZoom` ほか）を持つが、`filterShopsByZoom`（同ファイル）による店舗の間引きは現在の地図では使っていない

## 背景オーバーレイを変えるとき

見た目は `scripts/build-market-tint.mjs` の SVG を編集してスクリプトを実行し直し、`public/images/maps/market-tint.webp` を作り直す。範囲は `maplibre/MapViewMapLibre.tsx` の `MARKET_TINT_COORDS`。
