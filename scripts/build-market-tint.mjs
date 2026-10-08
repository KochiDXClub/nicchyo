/**
 * マップ背景の色かぶせ画像（市場エリア全体に乗せる琥珀色のグラデーション）を生成する。
 *
 * 以前は SVG をデータ URL で ImageOverlay に貼っていたが、SVG はズームのたびに
 * ブラウザが CPU で描き起こすため、最小ズームへの遷移が 2 倍以上遅くなっていた
 * （Discussion #535）。ピクセル画像にすれば描き起こしは読み込み時の 1 回で済み、
 * ズームは GPU の拡縮だけになる。
 *
 * 使い方: node scripts/build-market-tint.mjs
 * 出力:   public/images/maps/market-tint.webp（1024×410、ロスレス）
 *
 * 見た目を変えたいときは下の SVG を編集してこのスクリプトを実行し直す。
 * app/(public)/map/components/BackgroundOverlay.tsx の MARKET_TINT_SVG と同じ内容にしておくこと。
 */

import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const WIDTH = 1024;
const HEIGHT = 410; // 元の viewBox 400×160 と同じ比率

const marketTintSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <radialGradient id="mg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.02"/>
    </radialGradient>
  </defs>
  <rect width="400" height="160" fill="url(#mg)"/>
</svg>`;

const out = resolve("public/images/maps/market-tint.webp");
mkdirSync(dirname(out), { recursive: true });

// 半透明の階調をそのまま残したいのでロスレス。サイズは数 KB に収まる
const info = await sharp(Buffer.from(marketTintSvg), { density: 144 })
  .resize(WIDTH, HEIGHT)
  .webp({ lossless: true })
  .toFile(out);

console.log(`wrote ${out} (${info.width}×${info.height}, ${info.size} bytes)`);
