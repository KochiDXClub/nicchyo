# 店舗マーカーアーキテクチャ ドキュメント

## 概要

nicchyo 日曜市マップにおける店舗マーカーの描画構成をまとめる。

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
  fetch-map-data.ts（サーバー側取得）→ services/shopDb.ts（Supabase）
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
            （選択 / AI提案 / 検索ヒット / ことづて / お気に入り / 買い物袋）
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
| `app/(public)/map/config/roadConfig.ts` | 道の座標基準・中心線 |
| `app/globals.css` | 屋台・バッジ・バナーのスタイル実体 |
| `lib/shopImages.ts` | カテゴリ別のバナー画像の選択 |

`map-edit`（`app/(public)/map-edit/MapLayoutEditor.tsx`）も同じ
`OptimizedShopLayerWithClustering` を使う。マーカーの変更は運営の配置編集画面にも波及する。

## 屋台イラスト

屋台は画像ではなく **CSS で組んだ疑似3D**。`markerHtmlGenerator` が
6枚の div を出力し、`globals.css` の `.shop-illustration-3d` 配下が形を作る。

| 要素 | 役割 |
|---|---|
| `.stall-shadow` | 地面の影 |
| `.stall-roof` | 屋根（`skewX(-12deg)` で奥行きを出す） |
| `.stall-awning` | 庇（ストライプ） |
| `.stall-body` | 本体 |
| `.stall-counter` | カウンター |
| `.stall-legs` | 脚（3本） |

色は CSS 変数 `--stall-color` / `--stall-color-dark` / `--stall-color-light` で制御する。
light / dark はベース色から `adjustColor(±25)` で生成される。

`shop.illustration.customSvg` が指定されている場合は、`utils/svgSanitizer.ts` の
`sanitizeInlineSvg()` を通したうえで CSS 3D の代わりに埋め込む。

**注意**: `illustration`（type / size / color / customSvg）は型定義上は存在するが、
現状 `shopDb.ts` にも API にもマッピングが無く、DB から供給されていない。
そのため実運用では全店舗が `size: 'medium'`（60px）・既定色で描画される。

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

`OptimizedShopLayerWithClustering` はズームに応じて3種類のアイコンを切り替える。
アイコンの切り替えは `marker.setIcon()` による DOM の作り直しなので、
境界を増やすほど重くなる。

| モード | 内容 |
|---|---|
| `compact` | 棒状の簡易アイコン（`.shop-marker-compact`） |
| `mid` | 屋台イラストのみ |
| `full` | 屋台 + ミニショップバナー |

そもそも店舗レイヤ自体が表示されるかどうかは `MapView.tsx` / `MapOverlays.tsx` が決める。
メインマップでは丁目バッジ（`ChomeAreaMarkers`）の帯を抜けてから店舗が出る。

**注意**: `map-edit` はズーム条件なしにこのレイヤを描画し、`maxZoom` も
メインマップ（21）と異なる（20）。ズーム閾値を絶対値で書くと片方で破綻するため、
`map.getMaxZoom()` 相対で考えること。

## 状態の反映

すべて `marker.getElement()` へのクラス付け外しで行う。

| クラス | 意味 |
|---|---|
| `.shop-marker-selected` | 選択中 |
| `.shop-marker-ai` | AI が提案した店 |
| `.shop-marker-search` | 検索ヒット |
| `.shop-marker-comment` | コメントハイライト（パルス） |
| `.shop-marker-kotodute` | ことづてあり |
| `.shop-marker-bag` | 買い物リストに入っている |
| `.is-favorite` | お気に入り |

スポットライト（周囲を暗くする演出）は地図ルートの
`.map-spotlight-mode` / `.map-search-spotlight-mode` が担う。

## 店舗をタップしたときの流れ

1. `marker.on('click')` が `getOriginRect()` で開始位置の矩形を測る
2. `onShopClick(shop, origin)` → `MapView.tsx` の `handleShopClick`
3. 詳細帯のズームなら `ShopDetailBanner` を開く。俯瞰帯なら近傍の重心へ `flyTo` して拡大を促す

`ShopDetailBanner` は **MapContainer の外側**にレンダリングされる（地図の再描画を避けるため）。
開くアニメーションは `getOriginRect()` が返した矩形から展開する。

## 変更履歴上の注意

以下は既に削除済み。過去のドキュメントやコメントに名前が残っていることがある。

- `ShopMarker.tsx` / `ShopIllustration.tsx` / `ShopBubble.tsx` — React コンポーネント3層構成
- `OptimizedShopLayer.tsx` — `CircleMarker` 版のレイヤ
- `displayConfig.ts` の `getIllustrationSizeForZoom()` / `getIllustrationScaleForZoom()` / `IllustrationSize.bubbleOffset`
