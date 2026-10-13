# 店舗マーカーアーキテクチャ ドキュメント

## 概要

nicchyo 日曜市マップにおける店舗マーカーの描画構成をまとめる。

地図の描画ライブラリは2系統ある（`lib/mapFeatureFlags.ts` の `renderer`、既定は `maplibre`）。このドキュメントは Leaflet 版（撤去予定）（DOM マーカー）の構成。MapLibre 版（`components/maplibre/`）は WebGL で、屋台・建物・バッジを Canvas でビットマップに描き起こして `map.addImage` で登録し（`stallSprites.ts`）、店舗は GeoJSON のシンボルレイヤー（`shopFeatures.ts`）で描く。見た目の方針は [MAP_MARKER_DESIGN.md](./MAP_MARKER_DESIGN.md) を共通で参照する。

このドキュメントはかつて「店舗イラストと当たり判定のずれ」問題を解決した
React コンポーネント3層構成（`ShopMarker` / `ShopIllustration` / `ShopBubble`）を
説明していたが、その構成は既に使われていない。現在は Leaflet の生 API と
HTML 文字列生成による構成に置き換わっている。

## 設計原則（変わっていないもの）

**「1店舗 = 1データ + 1描画単位 + 1当たり判定」**

かつての課題は、店舗イラストが背景 SVG に静的に描かれ（SVG 座標系）、
当たり判定は別の `CircleMarker`（地図座標系）で持つという二重管理だった。
2つの座標系がズーム・デバイスによってズレ、クリック位置とイラスト位置が一致しなかった。

現在も「描画される DOM そのものが当たり判定である」という原則は維持されている。
`L.divIcon` が生成する DOM がそのままヒット領域になるため、CSS の transform や
スケールに当たり判定が自動追従する。

## 現在の構成

```
店舗データ
  page.tsx（サーバー側取得）→ services/shopCache.ts の fetchPublicShops → services/shopDb.ts（Supabase）
      ↓ props
  MapPageClient.tsx → MapView.tsx → MapOverlays.tsx
      ↓
  components/OptimizedShopLayerWithClustering.tsx
      │  react-leaflet の useMap() で Leaflet インスタンスを取得し、
      │  以降は Leaflet の生 API でマーカーを直接管理する
      │  （ズーム操作のたびに React が再レンダリングされるのを避けるため）
      │
      ├─ utils/markerHtmlGenerator.ts
      │     generateShopMarkerHtml() が HTML 文字列を組み立てる
      │
      ├─ L.divIcon({ html, className, iconSize, iconAnchor })
      │     iconSize / iconAnchor は config/displayConfig.ts の
      │     ILLUSTRATION_SIZES が唯一の正
      │
      └─ classList の付け外しで状態を反映
            （選択 / AI提案 / 検索ヒット / コメントハイライト / お気に入り）
      ↓
  app/globals.css
      屋台イラスト（CSS 3D）、バッジ、バナーの実体
```

### 主要ファイル

| ファイル | 役割 |
|---|---|
| `app/(public)/map/components/OptimizedShopLayerWithClustering.tsx` | マーカーの生成・更新・状態反映。Leaflet 生 API |
| `app/(public)/map/utils/markerHtmlGenerator.ts` | マーカーの HTML 文字列を生成 |
| `app/(public)/map/config/displayConfig.ts` | サイズ・ズーム別表示ルール |
| `app/(public)/map/config/roadConfig.ts` | 道の座標基準・中心線・道の南北判定（`getRoadSide`） |
| `app/(public)/map/config/shopCategories.ts` | カテゴリ色（`resolveStallColors`） |
| `app/(public)/map/config/stallParts.ts` | 屋台 SVG のパーツカタログ（屋根・庇の形） |
| `app/globals.css` | 屋台・バッジ・バナーのスタイル実体 |
| `lib/shopImages.ts` | カテゴリ別のバナー画像の選択 |

運営の配置編集画面（`app/(public)/map-edit/v3/`）は MapLibre 版のキャンバス（`components/MapEditCanvasMapLibre.tsx`）で、この Leaflet のレイヤーは使わない。

## 屋台イラスト

屋台は画像ではなく、`config/stallParts.ts` のパーツ（屋根 `gable`/`flat`/`arch`/`parasol`、庇 `stripe`/`plain`/`scallop`）から組む **1本の inline SVG**。
色は SVG 内に書かず、CSS 変数 `--stall-color` / `--stall-color-dark` / `--stall-color-light` で
`globals.css` が当てる（`resolveStallColors` がカテゴリ色から light / dark を生成）。
状態色（選択・AI・検索）は同じクラスに対する CSS の fill 上書きで効く。

描画方式は `stallRenderer` フラグ（`svg` が既定）。`div` にすると従来の CSS 疑似3D
（6枚の div。`.stall-shadow` / `.stall-roof` / `.stall-awning` / `.stall-body` /
`.stall-counter` / `.stall-legs`）に戻る。これは比較実験用。

`shop.illustration.customSvg` が指定されている場合は、`utils/svgSanitizer.ts` の
`sanitizeInlineSvg()` を通したうえで、どちらの方式よりも優先して埋め込む。

**注意**: `illustration`（type / size / color / roof / awning / customSvg）は型定義上は存在するが、
現状 `shopDb.ts` にも API にもマッピングが無く、DB から供給されていない。
そのため実運用では全店舗が `size: 'medium'`・既定の屋根と庇・カテゴリ色で描画される。

## スケールと回転

マーカーのスケールと回転は入れ子の2要素で分担している。

| 要素 | 付与元 | 役割 |
|---|---|---|
| `.custom-shop-marker`（Leaflet の `_icon`） | `L.divIcon` の `className` | Leaflet が `transform: translate3d(...)` を**インラインで**書き込み位置決めする。状態クラス（`.shop-marker-selected` 等）もここに付く |
| `.shop-marker-container` / `.shop-marker-compact-wrapper` | `markerHtmlGenerator` の出力 | スケールと回転補正を担う |

**重要**: 状態クラスは `_icon` に付くが、`_icon` には Leaflet がインラインで
`transform` を書き込むため、**状態クラス側に `transform` を書いても必ず負ける**。
拡大・縮小は必ず内側のラッパーに当てること。

```css
.shop-marker-container {
  transform: scale(calc(var(--shop-marker-zoom-scale, 1) * var(--shop-marker-state-scale, 1)));
  transform-origin: center bottom;
  rotate: var(--map-rotation-inverse, 0deg);
}
.shop-marker-selected .shop-marker-container { --shop-marker-state-scale: 1.15; }
```

- `--shop-marker-zoom-scale`: ズームに応じた倍率。`OptimizedShopLayerWithClustering` が JS で注入
- `--shop-marker-state-scale`: 選択・ハイライト時の倍率。CSS で定義
- `--map-rotation-inverse`: 地図の回転を打ち消してマーカーを正立させる。`MapView.tsx` が注入

## ズーム別の表示

表示の段階は4つ（`dot` / `stall` / `photo` / `nameplate`）。境界は `map.getMaxZoom()` からの
オフセットで持つ（`config/displayConfig.ts` の `getShopMarkerLod`）。詳細は
[MAP_MARKER_DESIGN.md](./MAP_MARKER_DESIGN.md)。

アイコンの DOM は2種類だけ（簡易の `dot` と屋台）。`stall` / `photo` / `nameplate` は同じ DOM を共有し、
ルート要素の `.shop-lod-*` クラスで写真・木札・バッジの表示を切り替える。
`marker.setIcon()`（DOM の作り直し）が走るのは `dot` と屋台の1境界だけ。

そもそも店舗レイヤ自体が表示されるかどうかは `MapView.tsx` / `MapOverlays.tsx` が決める
（`shopLayerHiding` が on なら、ズーム 19 未満ではレイヤーを外さずにペインごと隠す）。
メインマップでは丁目バッジ（`ChomeAreaMarkers`）の帯を抜けてから店舗が出る。

**注意**: ズーム閾値を絶対値で書くと `maxZoom` の違う地図で破綻するため、
`map.getMaxZoom()` 相対で考えること。

## 状態の反映

すべて `marker.getElement()` へのクラス付け外しで行う。

| クラス | 意味 |
|---|---|
| `.shop-marker-selected` | 選択中 |
| `.shop-marker-ai` | AI が提案した店 |
| `.shop-marker-search` | 検索ヒット |
| `.shop-marker-comment` | コメントハイライト（パルス） |
| `.is-favorite` | お気に入り |

スポットライト（周囲を暗くする演出）は地図ルートの
`.map-spotlight-mode` / `.map-search-spotlight-mode` が担う。

## 店舗をタップしたときの流れ

1. `marker.on('click')` が `getOriginRect()` で開始位置の矩形を測る
2. `onShopClick(shop, origin)` → `MapView.tsx` の `handleShopClick`
3. 詳細帯のズームなら `ShopDetailBanner` を開く。俯瞰帯なら近傍の重心へ `flyTo` して拡大を促す（`ViewMode` は `config/displayConfig.ts`）

`ShopDetailBanner` は **MapContainer の外側**にレンダリングされる（地図の再描画を避けるため）。
開くアニメーションは `getOriginRect()` が返した矩形（屋台イラストの矩形）から展開する。

## 変更履歴上の注意

以下は既に削除済み。過去のドキュメントやコメントに名前が残っていることがある。

- `ShopMarker.tsx` / `ShopIllustration.tsx` / `ShopBubble.tsx` — React コンポーネント3層構成
- `OptimizedShopLayer.tsx` — `CircleMarker` 版のレイヤ
- `displayConfig.ts` の `getIllustrationSizeForZoom()` / `getIllustrationScaleForZoom()` / `IllustrationSize.bubbleOffset`
