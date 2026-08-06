/**
 * 背景オーバーレイコンポーネント
 *
 * 【責務】
 * - マップ背景に雰囲気を演出する装飾を表示
 * - 道・店舗の視認性を邪魔しない
 * - 将来的な差し替えに対応
 *
 * 【レイヤー構造】
 * Layer 0: Leafletベースマップ
 * → Layer 1: BackgroundOverlay ← このコンポーネント
 * Layer 2: RoadOverlay（道）
 * Layer 3: 店舗層（OptimizedShopLayerWithClustering）
 * Layer 4: UI層
 *
 * 【現在の状態】
 * 今回は実装せず、構造だけ用意
 * 将来的に以下を追加可能:
 * - 日曜市の雰囲気を表す背景イラスト
 * - 微細なテクスチャ・パターン
 * - 季節の装飾
 */

'use client';

import { ImageOverlay } from 'react-leaflet';
import { LatLngBoundsExpression } from 'leaflet';

interface BackgroundConfig {
  enabled: boolean;
  imagePath?: string;
  bounds?: [[number, number], [number, number]];
  opacity?: number;
  zIndex?: number;
}

// 市場エリア全体に温かみのあるアンバートーンをのせる背景
const marketTintSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160">
  <defs>
    <radialGradient id="mg" cx="50%" cy="50%" r="65%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.02"/>
    </radialGradient>
  </defs>
  <rect width="400" height="160" fill="url(#mg)"/>
</svg>`;

const BACKGROUND_CONFIG: BackgroundConfig = {
  enabled: true,
  imagePath: `data:image/svg+xml,${encodeURIComponent(marketTintSvg)}`,
  bounds: [[33.5650, 133.5265], [33.5555, 133.5450]],
  opacity: 1.0,
  zIndex: 15,
};

export default function BackgroundOverlay() {
  if (!BACKGROUND_CONFIG.enabled || !BACKGROUND_CONFIG.imagePath) {
    return null;
  }

  return (
    <ImageOverlay
      url={BACKGROUND_CONFIG.imagePath}
      bounds={BACKGROUND_CONFIG.bounds as LatLngBoundsExpression}
      opacity={BACKGROUND_CONFIG.opacity}
      zIndex={BACKGROUND_CONFIG.zIndex}
    />
  );
}
