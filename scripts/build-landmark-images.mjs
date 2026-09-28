/**
 * マップの建物画像（map_landmarks.image_url の PNG）から、表示サイズに合わせた WebP を作る。
 *
 * 元の PNG は 1536×1024px・2〜3MB あるが、地図上では 130〜360px 幅でしか出ない。
 * MapLibre 版は「表示幅 × pixelRatio（最大 3）」に描き起こしてから登録するので、
 * 表示幅の 3 倍より大きい画素は一度も使われない。それでも初期化はこの画像を
 * すべて読み終えるまで屋台を出さないため、スマホ回線では店舗の表示が十数秒遅れていた。
 *
 * 使い方: node scripts/build-landmark-images.mjs
 * 出力:   public/images/maps/elements/buildings/*.webp（元 PNG の隣）
 *         app/(public)/map/data/optimizedLandmarkImages.json（元 URL → WebP の対応表）
 *
 * 建物を追加したり、管理画面で表示幅（width_px）を大きくしたりしたときは、
 * 下の TARGETS の displayWidthPx を合わせてこのスクリプトを実行し直す。
 */

import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR = "/images/maps/elements/buildings";
// displayWidthPx は map_landmarks.width_px（2026-09-26 時点の最大値）
const TARGETS = [
  { file: "KochiCastle.png", displayWidthPx: 358.4 },
  { file: "KochiCastleMusium2.png", displayWidthPx: 201.6 },
  { file: "Ohtepia.png", displayWidthPx: 174.72 },
  { file: "Train.png", displayWidthPx: 172.032 },
  { file: "hirome-market.png", displayWidthPx: 127.68 },
];
// MapViewMapLibre の landmarkRatio（Math.min(3, devicePixelRatio)）の上限と同じ
const MAX_PIXEL_RATIO = 3;

const manifest = {};
for (const { file, displayWidthPx } of TARGETS) {
  const src = resolve(`public${DIR}/${file}`);
  const outFile = file.replace(/\.png$/, ".webp");
  const out = resolve(`public${DIR}/${outFile}`);
  const width = Math.ceil(displayWidthPx * MAX_PIXEL_RATIO);
  const info = await sharp(src)
    // 元より大きくはしない
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(out);
  manifest[`${DIR}/${file}`] = `${DIR}/${outFile}`;
  console.log(`${file} → ${outFile}  ${info.width}×${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
}

const manifestPath = resolve("app/(public)/map/data/optimizedLandmarkImages.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(`→ ${manifestPath}`);
