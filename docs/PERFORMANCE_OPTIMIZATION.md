# マップのパフォーマンス方針

店舗約300件を載せる `/map` を、スマホで滑らかに動かすための要点。数値の実測は管理画面の計測ページ（`app/(public)/admin/map-perf`）と `MapPerfBridge.tsx` で取る。

## 構成の前提

- Leaflet 版は、店舗を `L.divIcon`（DOM マーカー）で描く。`OptimizedShopLayerWithClustering` が `useMap()` で Leaflet を取得し、生 API でマーカーを管理する。`leaflet.markercluster` の `markerClusterGroup` に載せているが、`disableClusteringAtZoom: 1` なので実質クラスタ化はせず、画面内のマーカーだけを DOM に載せる（ビューポート外のマーカーは載せない）ために使っている。屋台の見た目は [ARCHITECTURE_SHOP_MARKERS.md](./ARCHITECTURE_SHOP_MARKERS.md)
- MapLibre 版（`components/maplibre/`）は WebGL。店舗はシンボルレイヤーで GPU 描画する。移行中の並走検証用
- 切替と各施策のオン・オフは `lib/mapFeatureFlags.ts`。優先順位は URL の `?mapFlags=` → 管理画面の設定（`system_settings.map_flags`）→ 既定値。フラグの意味と既定値はそのファイルのコメントが正

## 入っている施策

| 施策 | 内容 | 場所 |
|---|---|---|
| ズームで React を再描画しない | ズーム値ではなく「表示モードの真偽値」だけを state に持つ（`zoomRenderIsolation`） | `MapView.tsx` |
| 店舗レイヤーを付け外ししない | 低ズームではペインごと非表示にし、境界をまたぐたびの 300 マーカー再生成を避ける（`shopLayerHiding`） | `OptimizedShopLayerWithClustering.tsx` |
| DOM の作り直しを 1 境界に限る | `stall` / `photo` / `nameplate` は同じ DOM で CSS クラスだけ切り替え、`setIcon()` は `dot` と他の境界だけ（[MAP_MARKER_DESIGN.md](./MAP_MARKER_DESIGN.md)） | `config/displayConfig.ts` |
| 屋台は 1 本の inline SVG | div を 6 枚積む方式より軽い（`stallRenderer` = `svg`） | `utils/markerHtmlGenerator.ts` |
| ランドマーク画像の倍率は CSS 変数 | ズームごとに DivIcon を作り直さない（`landmarkCssScale`） | `MapOverlays.tsx` ほか |
| 背景オーバーレイは WebP | SVG はズームごとに CPU で描き直されて遅かった（`backgroundOverlay` = `webp`） | `BackgroundOverlay.tsx` |
| 詳細バナーは MapContainer の外 | バナーの開閉で地図を再描画しない | `MapView.tsx` / `MapPageClient.tsx` |
| MapLibre 版の差分更新 | 表示状態が変わった店だけ地図に送る。`memo` で包み、現在地の更新で描き直さない | `maplibre/shopFeatures.ts` / `MapViewMapLibre.tsx` |
| 店舗データの取得 | サーバー側で取得して props で渡す（`fetchPublicShops`） | `app/(public)/map/page.tsx` / `services/shopCache.ts` |

## 計測するとき

1. Chrome DevTools の Performance で、ズーム操作を録画して Scripting 時間を前後比較する
2. React DevTools の Profiler で、ズーム中の再レンダリング回数を見る
3. 実験は `?mapFlags=<key>:<value>`（例: `roadSnap:integrated`）で切り替えて同条件で比べる。CPU スロットリングは 4 倍を目安にする
4. 結果から既定値を変えるときは、`lib/mapFeatureFlags.ts` の `DEFAULT_MAP_FEATURE_FLAGS` とそのコメント（計測日・結論）を更新する
