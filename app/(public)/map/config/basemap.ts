/**
 * ベクター背景（OpenFreeMap）の接続先。
 *
 * 地図本体（MapViewMapLibre）と、HTML の時点で先読みする page.tsx が
 * 必ず同じ URL を指すように、ここを唯一の定義元にする。
 */
export const OPENFREEMAP_ORIGIN = "https://tiles.openfreemap.org";

/** MapLibre に渡すスタイル */
export const OPENFREEMAP_STYLE_URL = `${OPENFREEMAP_ORIGIN}/styles/positron`;

/**
 * style.json の `sources.openmaptiles.url` が指す TileJSON。
 *
 * style を読み終えてから更にここへ 1 往復して、ようやくタイル URL が決まる。
 * この 2 往復が地図表示の critical path に乗っているので HTML の時点で先読みしておく。
 * TileJSON が返すタイル URL は日付入り（例: /planet/20260830_080001_pt/{z}/{x}/{y}.pbf）で
 * 定期的に切り替わるため、タイル URL 自体は直書きしない。
 */
export const OPENFREEMAP_TILEJSON_URL = `${OPENFREEMAP_ORIGIN}/planet`;

/**
 * ラスター背景（CARTO）で先に接続しておく origin。
 *
 * タイルは a〜d の 4 サブドメインに分散して取りに行くが、接続ごとに DNS + TLS が要るので、
 * 最初の画面で最も使われる 2 つだけ先に済ませる（MapViewMapLibre の CARTO_TILES と同じホスト）。
 */
export const CARTO_PRECONNECT_ORIGINS = [
  "https://a.basemaps.cartocdn.com",
  "https://b.basemaps.cartocdn.com",
] as const;
