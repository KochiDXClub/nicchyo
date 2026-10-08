/**
 * maplibre-gl のワーカーを public/maplibre/ へ複製する
 *
 * maplibre-gl v6 は ESM only になり、ワーカーを実ファイルの URL として読み込む。
 * Next.js（Turbopack・webpack どちらのモードでも）は
 * `new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url)` を
 * ハッシュ付きアセットに変換するが、そのとき隣に置かれるはずの
 * maplibre-gl-shared.mjs を一緒に出力しない。ワーカーは最初の import で失敗し、
 * 「地図は表示されるがタイルを一度も要求しない（＝真っ白）」状態になる。
 *
 * そのため2つのファイルを public/ から素のまま配信し、
 * lib/map/maplibreWorker.ts の setWorkerUrl でそこを指す。
 * ワーカーは maplibre-gl-shared.mjs を相対パスで import するので、
 * 2つは必ず同じディレクトリに置く必要がある。
 *
 * node_modules からビルド時に複製するので、常にインストール済みのバージョンと一致する。
 * npm のライフサイクル prefix はスクリプト名の完全一致なので、prebuild / predev は
 * build / dev の前に走るが、独自名のスクリプトの前には走らない点に注意。
 */

import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const dist = path.join(
  path.dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")),
  "dist"
);
const dest = path.join(process.cwd(), "public", "maplibre");

mkdirSync(dest, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(path.join(dist, file), path.join(dest, file));
}

console.log(`[copy-maplibre-worker] ${dest} に複製しました`);
