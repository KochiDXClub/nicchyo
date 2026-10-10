import { fetchMapFeatureFlags } from '@/lib/mapFeatureFlags.server';
import {
  CARTO_PRECONNECT_ORIGINS,
  OPENFREEMAP_ORIGIN,
  OPENFREEMAP_STYLE_URL,
  OPENFREEMAP_TILEJSON_URL,
} from './config/basemap';

/**
 * 先読みタグを置くためだけの layout。
 *
 * page.tsx は店舗・建物・道を取り終えてから JSX を返すので、page 側にタグを置くと
 * データが揃うまで（実測で本番プレビュー約2.9秒）ブラウザに届かず、地図が
 * 要求する直前にしか先読みが始まらない。layout は page がデータを待っている間に
 * シェルとして先に流れるので、ここに置くと TTFB 直後に接続と取得が始まる。
 *
 * フラグの取得は system_settings の 1 行だけで、page.tsx と同じ結果を
 * React の cache 経由で共有するため、問い合わせは 1 リクエストにつき 1 回で済む。
 */
export default async function MapLayout({ children }: { children: React.ReactNode }) {
  const featureFlags = await fetchMapFeatureFlags();
  const usesVectorBasemap = featureFlags.basemap === 'vector-openfreemap';
  const usesRasterBasemap = !usesVectorBasemap;

  return (
    <>
      {/*
        MapLibre の Worker と共有モジュール（約 500KB）。メインチャンクが実行され Map を作ってから
        取りに行くと更に 2 往復かかるので、HTML の時点で取得を始める。
        public/maplibre/ に置いた実ファイル（lib/map/maplibreWorker.ts が指す先）と同じパス
      */}
      <link rel="modulepreload" href="/maplibre/maplibre-gl-worker.mjs" />
      <link rel="modulepreload" href="/maplibre/maplibre-gl-shared.mjs" />
      {usesRasterBasemap &&
        CARTO_PRECONNECT_ORIGINS.map((origin) => (
          <link key={origin} rel="preconnect" href={origin} crossOrigin="anonymous" />
        ))}
      {usesVectorBasemap && (
        <>
          {/* DNS + TLS を先に済ませる */}
          <link rel="preconnect" href={OPENFREEMAP_ORIGIN} crossOrigin="anonymous" />
          {/* style.json と TileJSON の 2 往復を critical path から外す */}
          <link rel="preload" as="fetch" href={OPENFREEMAP_STYLE_URL} crossOrigin="anonymous" />
          <link rel="preload" as="fetch" href={OPENFREEMAP_TILEJSON_URL} crossOrigin="anonymous" />
        </>
      )}
      {children}
    </>
  );
}
