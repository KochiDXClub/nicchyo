# 画像最適化ガイド

サイトで扱う画像の種類ごとに、どこで・どう軽くしているかをまとめる。新しい画像を足すときは、まず該当する行のやり方に合わせる。

## 画像の種類と方針

| 種類 | 方針 | 場所 |
|---|---|---|
| 出店者がアップロードする店舗写真 | ブラウザ（Canvas）で縮小してから保存する。メイン用は最大 1200px、サムネイル用は最大 400px（地図の屋台の写真にも使うため）、どちらも WebP | `lib/image/clientCompression.ts`（`STORE_IMAGE_CONFIG`）、`app/vendor/_services/storeService.ts` |
| 近況・お知らせの投稿画像 | 同じくブラウザで最大 1200px の WebP にする | `lib/image/clientCompression.ts`（`POST_IMAGE_CONFIG`） |
| マップ・スキャンカード・検索結果の店舗画像 | サムネイルを優先して読み、無い・読めないときはメイン画像に戻す | `lib/shopImages.ts`（`getShopThumbnailImage` / `toStoreThumbUrl`） |
| 地図の建物（ランドマーク）画像 | WebP だけを `public/` に置く（PNG は置かない）。DB の `map_landmarks.image_url` も `.webp`。古い `.png` が残っていても `map/utils/landmarkImages.ts` が `.webp` に読み替える | `public/images/maps/elements/buildings/*.webp` |
| 地図の背景の色かぶせ | ズームのたびに CPU で描き直される SVG をやめ、WebP にしてある | `scripts/build-market-tint.mjs` → `public/images/maps/market-tint.webp` |
| カテゴリ別バナー等の静的画像 | `public/images/` に WebP で置く（例: `public/images/shops/*.webp`） | `lib/shopImages.ts` |
| 屋台のイラスト | 画像ではなく SVG / CSS で描く。画像を配るのは `illustration.customSvg` のときだけで、現在は DB から供給されていない | [ARCHITECTURE_SHOP_MARKERS.md](./ARCHITECTURE_SHOP_MARKERS.md) |

## ルール

- 表示に使うタグは `next/image` の `<Image>`。`next.config.js` の `images` で `image/webp` と `image/avif` を配信し、外部は `*.supabase.co` の公開ストレージだけを許可している
- 表示サイズの 3 倍（pixelRatio の上限）より大きい画素は使われない。大きな元画像をそのまま載せない
- Base64 の埋め込みは、HTML・JS のサイズが膨らむので避ける
- Content-Type と拡張子は `imageUploadInfo()`（`lib/image/clientCompression.ts`）に合わせる。`image/webp` と決め打ちして保存すると、中身と食い違って表示できなくなることがある

## 既存のサムネイルを作り直す

サムネイルの大きさ（`STORE_IMAGE_CONFIG.thumbnail`）を変えたら、保存済みの店舗写真のサムネイルも作り直す。今の店舗写真（`store-main.*`）から `store-thumb.webp` だけを作り直し、メイン画像・DB・ほかのファイルには触らない（店舗写真が `store-main.*` でない未移行の店は飛ばす）。既に十分な大きさのものも飛ばすので、何度実行してもよい。`.env.local` に `NEXT_PUBLIC_SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` が要る。

```bash
npm run migrate:vendor-images -- --refresh-thumbs --dry-run   # 何が作り直されるかだけ見る
npm run migrate:vendor-images -- --refresh-thumbs             # 本番を書き換える
```

公開 URL は同じなので、端末・CDN に残った古いサムネイルはキャッシュの期限（既定 1 時間）で入れ替わる。

## 静的画像を WebP にする

PNG・JPEG は `public/` に置かず、WebP（Quality 85 前後）に変換してから置く。変換は `sharp`（`package.json` には直接入っておらず Next.js 経由で入る。既存の `scripts/build-*.mjs` が手本）か [Squoosh](https://squoosh.app/) で行い、元の PNG は残さない（デプロイのたびに丸ごと複製され、Vercel の Deployment Storage を圧迫するため）。

## 確認

Chrome DevTools の Network で Disable cache にしてリロードし、画像の転送サイズと形式（webp / avif）を見る。
