# モバイル Viewport 対応

スマホブラウザのアドレスバーの出し入れや iOS の切り欠きに対して、地図を全画面に置いても崩れないようにする仕組み。

## 仕組み

| 要素 | 場所 | 役割 |
|---|---|---|
| `100dvh` と `--vh` | `app/globals.css` | `body` の高さ。`100dvh` を優先し、非対応ブラウザ向けに `calc(var(--vh, 1vh) * 100)` を後ろに書いてフォールバック。Tailwind では `h-[100dvh]` を使う |
| `ViewportHeightUpdater` | `app/components/ViewportHeightUpdater.tsx` | `window.innerHeight` から `--vh` を更新（`resize` と `orientationchange`。iOS Safari 向けに 100ms 遅らせる）。`app/layout.tsx` が配置 |
| `--safe-top/bottom/left/right` | `app/globals.css` | `env(safe-area-inset-*)` を `@supports` で取り込む。非対応なら `0px` |
| `--nav-bar-height` | `app/globals.css` | `NavigationBar` の内側の高さ（`3.5rem`）。下に固定する要素はこれと `--safe-bottom` を避ける |
| `viewportFit: "cover"` | `app/layout.tsx` の `viewport` | iOS の Safe Area を有効にする。これが無いと `env()` が常に 0 |

## レイアウト

- `MapPageClient.tsx` のルートは `h-[100dvh]`。メイン領域の下余白は `calc(3.5rem + var(--safe-bottom, 0px))`（`NavigationBar` と Safe Area の分）
- `NavigationBar`（`app/components/NavigationBar.tsx`）は `fixed bottom-0`、`z-[9997]`、半透明（`bg-white/90 backdrop-blur-md`）。下側の Safe Area はこの要素が避ける
- メニューは `MenuContext`（`lib/ui/MenuContext.tsx`）が開閉を持ち、`HamburgerMenu`（`app/components/HamburgerMenu.tsx`）が右からスライドする。高さは `h-[100dvh]` に `--vh` のフォールバック。`AppHeader` は現在は何も描画しない（`null` を返すだけ）

## z-index（グローバルUI）

| 要素 | z-index |
|---|---|
| ハンバーガーボタン | `10002` |
| スライドメニュー | `9999` |
| メニュー背面のオーバーレイ | `9998` |
| ナビゲーションバー | `9997` |

地図内（Leaflet のペイン）の z-index は [LAYER_ARCHITECTURE.md](./LAYER_ARCHITECTURE.md)。

## 確認項目（実機）

- アドレスバーの表示／非表示、画面回転のあとで高さが崩れない（iOS Safari / Android Chrome）
- ホームインジケーター・ジェスチャーバーがナビゲーションを隠さない
- メニューの開閉が正しく動く
- 地図のズーム・パンでページ自体がスクロールしない（`overscroll-behavior: none`）

## 困ったとき

- iOS で切り欠きに重なる → `viewportFit: "cover"` が `app/layout.tsx` にあるか
- アドレスバーの出没で位置がずれる → `ViewportHeightUpdater` が `layout.tsx` に入っているか
