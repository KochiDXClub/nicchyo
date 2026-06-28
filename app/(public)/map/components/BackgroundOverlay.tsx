/**
 * 背景オーバーレイコンポーネント
 *
 * 【責務】
 * - マップ背景に雰囲気を演出する装飾・イラストを表示
 * - 道・店舗の視認性を邪魔しない
 * - 将来的な差し替えに対応
 *
 * 【レイヤー構造】
 * Layer 0: Leafletベースマップ
 * → Layer 1: BackgroundOverlay ← このコンポーネント
 * Layer 2: RoadOverlay（道）
 * Layer 3: ShopMarker（店舗）
 * Layer 4: UI層
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

const TINT_CONFIG: BackgroundConfig = {
  enabled: true,
  imagePath: `data:image/svg+xml,${encodeURIComponent(marketTintSvg)}`,
  bounds: [[33.5650, 133.5265], [33.5555, 133.5450]],
  opacity: 1.0,
  zIndex: 15,
};

// 最大縮小（全体図）専用の引き絵。位置・サイズは実地図との目視確認を経て固定済み。
const MIN_ZOOM_ILLUSTRATION_CONFIG: BackgroundConfig = {
  enabled: true,
  imagePath: '/images/maps/background/sunday-market-min-zoom.webp',
  bounds: [
    [33.571213383579554, 133.55748451999997],
    [33.55191066960047, 133.52301938000002],
  ],
  opacity: 0.7,
  zIndex: 16,
};

interface BackgroundOverlayProps {
  /** 最大縮小付近（OVERVIEWの最小寄り）のときのみ true */
  isMinimumZoomMode: boolean;
}

export default function BackgroundOverlay({ isMinimumZoomMode }: BackgroundOverlayProps) {
  return (
    <>
      {TINT_CONFIG.enabled && TINT_CONFIG.imagePath && (
        <ImageOverlay
          url={TINT_CONFIG.imagePath}
          bounds={TINT_CONFIG.bounds as LatLngBoundsExpression}
          opacity={TINT_CONFIG.opacity}
          zIndex={TINT_CONFIG.zIndex}
        />
      )}
      {isMinimumZoomMode && MIN_ZOOM_ILLUSTRATION_CONFIG.enabled && MIN_ZOOM_ILLUSTRATION_CONFIG.imagePath && (
        <ImageOverlay
          url={MIN_ZOOM_ILLUSTRATION_CONFIG.imagePath}
          bounds={MIN_ZOOM_ILLUSTRATION_CONFIG.bounds as LatLngBoundsExpression}
          opacity={MIN_ZOOM_ILLUSTRATION_CONFIG.opacity}
          zIndex={MIN_ZOOM_ILLUSTRATION_CONFIG.zIndex}
        />
      )}
    </>
  );
}
