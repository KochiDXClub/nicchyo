/**
 * maplibre-gl のワーカーの置き場所を教える
 *
 * v6 のワーカーはバンドラ経由だと自動では解決できないため、
 * public/maplibre/ に置いた実ファイルを指す（複製は scripts/copy-maplibre-worker.mjs、
 * package.json の prebuild / predev で走る）。これを呼ばないと地図は表示されるのに
 * タイルを一度も要求せず、真っ白なまま止まる。
 *
 * Map を作るファイルの先頭で副作用として読み込む。setWorkerUrl は全体で1回でよいが、
 * 同じ値を複数回渡しても問題はない。
 */

import { setWorkerUrl } from "maplibre-gl";

export const MAPLIBRE_WORKER_URL = "/maplibre/maplibre-gl-worker.mjs";

setWorkerUrl(MAPLIBRE_WORKER_URL);
