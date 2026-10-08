/**
 * 背景オーバーレイコンポーネント
 *
 * 【責務】
 * - 市場エリア全体に温かみのある琥珀色をふんわり乗せる（雰囲気の演出）
 * - 道・店舗の視認性を邪魔しない
 *
 * 【レイヤー構造】
 * Layer 0: Leafletベースマップ
 * → Layer 1: BackgroundOverlay ← このコンポーネント
 * Layer 2: RoadOverlay（道）
 * Layer 3: 店舗層（OptimizedShopLayerWithClustering）
 * Layer 4: UI層
 *
 * 【画像形式について】
 * 既定は WebP（public/images/maps/market-tint.webp、scripts/build-market-tint.mjs で生成）。
 * 以前は SVG をデータ URL で貼っていたが、SVG はズームのたびにブラウザが CPU で描き起こすため、
 * 最小ズームへの遷移が 2 倍以上遅くなっていた（Discussion #535）。
 * SVG 版は比較実験用に残している（lib/mapFeatureFlags.ts の backgroundOverlay = "svg"）。
 */

'use client';

import { ImageOverlay } from 'react-leaflet';
import { LatLngBoundsExpression } from 'leaflet';

export type BackgroundOverlayFormat = 'webp' | 'svg';

/** 市場エリアの範囲（南北・東西）。画像はこの矩形に引き伸ばされる */
const MARKET_BOUNDS: [[number, number], [number, number]] = [
  [33.5650, 133.5265],
  [33.5555, 133.5450],
];

const MARKET_TINT_WEBP = '/images/maps/market-tint.webp';

// scripts/build-market-tint.mjs と同じ内容。WebP を作り直すときはあちらも合わせる
const MARKET_TINT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160">
  <defs>
    <radialGradient id="mg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.02"/>
    </radialGradient>
  </defs>
  <rect width="400" height="160" fill="url(#mg)"/>
</svg>`;
const MARKET_TINT_SVG_URL = `data:image/svg+xml,${encodeURIComponent(MARKET_TINT_SVG)}`;

export default function BackgroundOverlay({ format = 'webp' }: { format?: BackgroundOverlayFormat }) {
  return (
    <ImageOverlay
      // key を変えて、形式の切替時に Leaflet 側の画像要素を作り直す
      key={format}
      url={format === 'svg' ? MARKET_TINT_SVG_URL : MARKET_TINT_WEBP}
      bounds={MARKET_BOUNDS as LatLngBoundsExpression}
      opacity={1.0}
      zIndex={15}
    />
  );
}
