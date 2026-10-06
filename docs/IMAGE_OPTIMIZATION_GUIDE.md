# 画像最適化ガイド

サイトで扱う画像の種類ごとに、どこで・どう軽くしているかをまとめる。新しい画像を足すときは、まず該当する行のやり方に合わせる。

## 画像の種類と方針

| 種類 | 方針 | 場所 |
|---|---|---|
| 出店者がアップロードする店舗写真 | ブラウザ（Canvas）で縮小してから保存する。メイン用は最大 1200px、サムネイル用は最大 160px、どちらも WebP | `lib/image/clientCompression.ts`（`STORE_IMAGE_CONFIG`）、`app/vendor/_services/storeService.ts` |
| 近況・お知らせの投稿画像 | 同じくブラウザで最大 1200px の WebP にする | `lib/image/clientCompression.ts`（`POST_IMAGE_CONFIG`） |
| マップ・スキャンカード・検索結果の店舗画像 | サムネイルを優先して読み、無い・読めないときはメイン画像に戻す | `lib/shopImages.ts`（`getShopThumbnailImage` / `toStoreThumbUrl`） |
| 地図の建物（ランドマーク）画像 | 元の PNG（約 1536×1024）を表示幅に合わせた WebP に変換し、対応表で差し替える。DB の `map_landmarks.image_url` は元のまま | `scripts/build-landmark-images.mjs` → `public/images/maps/elements/buildings/*.webp` と `app/(public)/map/data/optimizedLandmarkImages.json`。差し替えは `map/utils/landmarkImages.ts` |
| 地図の背景の色かぶせ | ズームのたびに CPU で描き直される SVG をやめ、WebP にしてある | `scripts/build-market-tint.mjs` → `public/images/maps/market-tint.webp` |
| カテゴリ別バナー等の静的画像 | `public/images/` に WebP で置く（例: `public/images/shops/*.webp`） | `lib/shopImages.ts` |
| 屋台のイラスト | 画像ではなく SVG / CSS で描く。画像を配るのは `illustration.customSvg` のときだけで、現在は DB から供給されていない | [ARCHITECTURE_SHOP_MARKERS.md](./ARCHITECTURE_SHOP_MARKERS.md) |

## ルール

- 表示に使うタグは `next/image` の `<Image>`。`next.config.js` の `images` で `image/webp` と `image/avif` を配信し、外部は `*.supabase.co` の公開ストレージだけを許可している
- 表示サイズの 3 倍（pixelRatio の上限）より大きい画素は使われない。大きな元画像をそのまま載せない
- Base64 の埋め込みは、HTML・JS のサイズが膨らむので避ける
- Content-Type と拡張子は `imageUploadInfo()`（`lib/image/clientCompression.ts`）に合わせる。`image/webp` と決め打ちして保存すると、中身と食い違って表示できなくなることがある

## 静的画像を WebP にする

スクリプトで変換するなら `sharp` を使う（`package.json` には直接入っておらず Next.js 経由で入る。既存の `scripts/build-*.mjs` が手本）。単発なら [Squoosh](https://squoosh.app/) で WebP（Quality 85 前後）に変換して `public/images/` に置けばよい。

## 確認

Chrome DevTools の Network で Disable cache にしてリロードし、画像の転送サイズと形式（webp / avif）を見る。
