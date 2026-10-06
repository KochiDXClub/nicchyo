# Leaflet → MapLibre 完全移行計画

調査日: 2026-10-06 / 対象ブランチ時点の `develop`

## 1. 現状

公開マップは `lib/mapFeatureFlags.ts` の `renderer`（既定 `leaflet`）で 2 系統を並走させている。
地図本体は `MapPageClient.tsx` が `dynamic()` で出し分け、ページ側の UI（ズームスライダー、「このへん」、
おでかけサポート、検索結果シート）は `types/mapCamera.ts` の `MapCamera` 抽象を介して共用している。

すでに MapLibre 化済み: 管理画面の表示範囲（`MapViewRangeClient`）、マップ編集 v3（`MapEditCanvasMapLibre`）、
紹介ミニマップ、`LocationPicker`（`maplibre` 参照あり）。**残る Leaflet は公開マップ本体のみ。**

## 2. 残っている依存

### 2-1. npm パッケージ（`package.json`）
`leaflet` / `react-leaflet` / `leaflet.markercluster` / `@types/leaflet` / `@types/leaflet.markercluster`

### 2-2. Leaflet を import しているコード（削除対象）

| ファイル | 行数 | MapLibre 側の対応 |
|---|---|---|
| `map/components/MapView.tsx` | 1321 | `maplibre/MapViewMapLibre.tsx`（1297） |
| `map/components/OptimizedShopLayerWithClustering.tsx` | 578 | シンボルレイヤー（`shopFeatures.ts` / `stallSprites.ts`） |
| `map/components/RoadOverlay.tsx` | 531 | `MapViewMapLibre` 内の道レイヤー |
| `map/components/MapOverlays.tsx` | 309 | ランドマーク画像・地名ラベルは移植済み |
| `map/components/UserLocationMarker.tsx` | 367 | `useMapLibreUserLocation.ts` |
| `map/components/GuideLayer.tsx` | 349 | **両対応**（`isLeafletMap` 分岐。Leaflet 側を削除） |
| `map/components/ChomeAreaMarkers.tsx` | 145 | 丁目バッジは HTML マーカーで移植済み |
| `map/components/BackgroundOverlay.tsx` | 60 | 色かぶせは移植済み |
| `map/components/MapPerfBridge.tsx` | 65 | `MapViewMapLibre` 内の `__nicchyoMapBench` |
| `map/hooks/useMapGestures.ts` | 431 | 不要（MapLibre 標準ジェスチャー） |
| `map/hooks/useMapCameraController.ts` | 120 | 不要 / `markManualRotation` 相当の要否を確認 |
| `map/utils/autoRotation.ts` | 101 | `MapViewMapLibre` に bearing 計算あり。`L` への依存だけ除去して共用可否を判断 |

合計およそ 4,400 行が削除対象。

### 2-3. Leaflet 前提の副次的な箇所
- `app/globals.css`: `.leaflet-container`（105行）、`.leaflet-shop-pane`（1439行）、`.map-edit-marker-popup .leaflet-popup-*`（1206〜1219行）、
  Leaflet の `_icon` transform 前提のコメントとルール（382 / 829 / 995行付近の `.custom-shop-marker` `.facility-marker-container` など）。計25行ほどヒット
- `lib/mapFeatureFlags.ts`: `MapRenderer` 型と `renderer` フラグ、Leaflet 専用フラグ（下記）
- `lib/perf/mapBenchmark.ts`: `.leaflet-marker-icon` / `.leaflet-shop-pane` の DOM 計測分岐
- `scripts/map-bench.mjs`: `renderer: ["leaflet","maplibre"]` の比較軸
- `app/(public)/admin/map-perf/`（`MapPerfPieces.tsx`, `useMapPerfState.ts`）: renderer スイッチ
- `app/(public)/admin/map-view/MapViewRangeClient.tsx`: 「renderer が maplibre でないと効かない」注意書き
- `app/(public)/map/components/ShopScanCards.tsx`: `isLeafletMap` で Leaflet 版は非表示にしている分岐
- `types/mapCamera.ts`: `isLeafletMap`、Leaflet 換算ズームの注釈
- `next.config.js`: `reactStrictMode: false` のコメント（Leaflet 互換）。**MapLibre は StrictMode の二重 mount 対策が要る**ので後述
- `map/components/MapView.tsx` の型 `MapViewProps` を `maplibre/MapViewMapLibre.tsx` が import している（切り離しが必要）
- ドキュメント: `CLAUDE.md`（Tech Stack / Map / 重要な制約）、`README.md`、`AGENTS.md`、`.github/copilot-instructions.md`、
  `docs/map-spec.md`、`docs/LAYER_ARCHITECTURE.md`、`docs/ARCHITECTURE_SHOP_MARKERS.md`、`docs/MAP_MARKER_DESIGN.md`、
  `docs/PERFORMANCE_OPTIMIZATION.md`、`docs/MOBILE_VIEWPORT_OPTIMIZATION.md`、`.jules/bolt.md`

### 2-4. Leaflet 専用フラグ（MapLibre 版では不要になる）
- `stallRenderer`（svg / div）: MapLibre は Canvas スプライトのみ
- `zoomSkip`: Leaflet のズーム確定フック前提
- `shopLayerHiding`: Leaflet のペイン可視切替
- `landmarkCssScale`: MapLibre は `icon-size` の式で追従
- `zoomRenderIsolation`: MapLibre 側で未使用（`MapPageClient` 側で効いているかを要確認）
- `backgroundOverlay: svg`（比較実験用）
- `renderer`、`MapRenderer`、`MAP_RENDERERS`

`roadSnap` / `tileOpacityByZoom` / `backgroundOverlay (webp|off)` / `basemap` / `crowd` は MapLibre 版も使っているので残す。

## 3. 機能パリティのギャップ（移行前に必ず埋める）

`MapViewMapLibre.tsx` のヘッダーにも明記されている通り、**「まだ無いもの」は出店者のカスタム SVG 屋台**。

1. **`illustration.customSvg` の店舗が MapLibre では描画されない（最重要）**
   `shopFeatures.ts:33` で `customSvg` の店を GeoJSON から除外し、`stallSprites.ts:367` も描画をスキップ。
   `buildStallSprites` の docstring は「個別に normal だけ描く」と書いているが実装は未対応。
   → 切替後に該当店舗が地図から消える。対応案: 店舗ごとに `rasterizeSvg(sanitizeInlineSvg(customSvg))` で個別スプライトを作り、
   `spriteKey` を `custom:<id>` にする（状態違いは normal のみ、検索ハイライト等は枠・バッジで代替）。
   サニタイズは既存の `utils/svgSanitizer.ts`（`markerHtmlGenerator.ts:65` と同じ入口）を必ず通す。
2. **本番データに `customSvg` が何件あるかの確認**（Supabase で件数を数える）。0 件なら 1 は優先度を下げられる。
3. **タップ領域・重なり順**: DOM マーカー（Leaflet）と違い、シンボルレイヤーは衝突判定（`icon-allow-overlap` 等）の設定次第で
   混雑時に店が欠ける。実機の 300 店舗で目視確認する。
4. **回転後の座標系**: Leaflet 版は回転シェル内座標のため `ShopScanCards` を出していない。MapLibre 専用に統一したら `isLeafletMap` 分岐を消し、
   常時有効化（仕様として出してよいかはプロダクト側の確認）。
5. **React StrictMode**: `reactStrictMode: false` は Leaflet 都合。MapLibre は `map.remove()` のクリーンアップが正しければ
   StrictMode でも動く。外すかは任意だが、外す場合は開発時の二重 mount で WebGL コンテキストが漏れないことを確認。
6. **WebGL 非対応端末のフォールバック**: Leaflet は WebGL 不要だった。非対応時の表示（エラー表示 or 簡易表示）を決める。
   `maplibregl.supported` 相当（v6 の API を確認）で検知して案内を出す。
7. **CSP / Worker**: `proxy.ts:152` に `blob:` Worker 許可は済み。`scripts/copy-maplibre-worker.mjs` と `lib/map/maplibreWorker.ts` は残す。
8. **パフォーマンス・バッテリー**: 低スペック端末で `map-bench` を取り、Leaflet 比で悪化していないか確認（`npm run` ではなく `node scripts/map-bench.mjs`）。
9. **背景ベクタータイル**: `basemap` は既定 `raster-carto`。`vector-openfreemap` に切り替えるかは別判断（外部サービス依存・ライセンス表記）。
   移行 PR には含めず、既定値は現状維持。

## 4. 手順（PR を 1 目的ずつ小さく出す）

> 「1 PR 1 目的・変更 10 ファイル以内」「`develop` へ」「来訪者に見える変更は `docs/changelog-unreleased/` を追加」が前提。
> 各 PR の前に `npm run code-health`、出す前に `npm run code-health:diff` と `npm run build` / `npm run lint` / `npm test`。

### Phase 0: 事前確認（コード変更なし）
- [ ] 本番 `shops` の `customSvg` 件数を確認（ギャップ 1・2）
- [ ] `mapFlags=renderer:maplibre` で主要導線を実機確認し、差分リストを作る
  （ズーム・回転・ピンチ・現在地追従・店舗タップ→バナー・検索ハイライト・お気に入り・買い物袋・
  AI案内・おでかけサポートのルート表示・ランドマークタップ・イントロ）
- [ ] 現在の `renderer` の本番設定値（`system_settings.map_flags`）を確認

### Phase 1: MapLibre 版の不足を埋める
- **PR 1**: カスタム SVG 屋台を MapLibre に対応（`shopFeatures.ts` / `stallSprites.ts` / テスト）
- **PR 2**: `MapViewProps` を `MapView.tsx` から切り出して共有型にする（`types/mapViewProps.ts` など）。
  `MapViewMapLibre` が Leaflet 側ファイルを import しない状態にする（後続の削除を安全にする）
- **PR 3**: 混雑時の欠け・重なり、WebGL 非対応時のフォールバック、StrictMode 対応（必要なら）
- 各 PR で `shopFeatures.test.ts` 等にテスト追加

### Phase 2: 既定値の切替（ロールアウト）
- **PR 4**: `DEFAULT_MAP_FEATURE_FLAGS.renderer` を `"maplibre"` に変更（変更 1〜2 ファイル）
  → ステージングで確認後、管理画面の `map_flags` を `maplibre` に更新して段階公開。
  不具合時は管理画面から `leaflet` に戻せる（この間は Leaflet が保険）
- 1〜2 回の日曜市（実運用）を観察し、エラー・問い合わせ・パフォーマンス指標を確認。
  **Leaflet 削除はこの観察期間が終わってから**

### Phase 3: Leaflet コードの撤去
- **PR 5**: 公開マップから Leaflet 分岐を外す
  （`MapPageClient` の `dynamic` 出し分け、`GuideLayer` の Leaflet 分岐、`ShopScanCards` の `isLeafletMap`、`types/mapCamera.ts`）
- **PR 6**: Leaflet ファイル削除（2-2 の表の全ファイル。`autoRotation.ts` は共用部分だけ残す）
- **PR 7**: Leaflet 専用フラグの削除（2-4）。`lib/mapFeatureFlags.ts`・設定画面・計測ページ・`map-bench.mjs`・
  `mapBenchmark.ts` の Leaflet 計測分岐・`map_flags` の保存済み JSON（未知キーは `normalizeMapFeatureFlags` が無視するので互換は問題なし）
- **PR 8**: `globals.css` の Leaflet 専用ルール削除。**削除前に `npm run dev` で各ルールが MapLibre の DOM（丁目バッジ・
  イントロの `.custom-shop-marker` など）にも当たっていないか確認**。当たるものは名前を変えて残す
- **PR 9**: `npm uninstall leaflet react-leaflet leaflet.markercluster @types/leaflet @types/leaflet.markercluster`、
  `package-lock.json` 更新、`next.config.js` のコメント整理（`reactStrictMode` の扱い）
- **PR 10**: ドキュメント更新（`CLAUDE.md` の Tech Stack・重要な制約・マップ構造、`README.md`、`AGENTS.md`、
  `.github/copilot-instructions.md`、`docs/` 配下、`.jules/bolt.md`）。`docs/LAYER_ARCHITECTURE.md` は MapLibre のレイヤー構成に書き直す

### Phase 4: 仕上げ確認
- [ ] `grep -rniE "leaflet" --exclude-dir=node_modules --exclude-dir=.next .` が `docs/` の履歴記述と
  `supabase/migrations`（過去マイグレーション。変更しない）だけになる
- [ ] `npm run build` で `leaflet` チャンクが消えたこと、JS サイズの増減を記録
- [ ] `npm run code-health:diff` で悪化なし
- [ ] リリース: `docs/RELEASE.md` に従い `develop` → `main`

## 5. リスクと戻し方
- Phase 2 までは `renderer` フラグで即座に Leaflet に戻せる。Phase 3 に入ると戻せないので、観察期間を必ず挟む
- 最大のリスクは **カスタム SVG 屋台の消失**（PR 1 が完了するまで Phase 2 に進まない）
- `docs/` と `CLAUDE.md` を最後にまとめて直すと古い記述が AI エージェントの判断を誤らせるため、
  PR 5 以降はコードと同じ PR で最低限の記述（Tech Stack 行）も直す

## 6. 未確認事項（着手前に確認したい）
- 本番の `customSvg` 件数
- `zoomRenderIsolation` が MapLibre 版で実際に効いているか（Leaflet 専用なら 2-4 に加える）
- `useMapCameraController` の `markManualRotation` / `snapRotationToVisibleRoad` が MapLibre 版の吸着ロジックと重複していないか
- `app/(public)/map/components/intro/*` が Leaflet の CSS クラスに依存していないか（`IntroStall.tsx:191` のコメント参照）
- WebGL 非対応端末を切り捨ててよいか（プロダクト判断）
