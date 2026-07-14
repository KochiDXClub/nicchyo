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

// 最小倍率の次の倍率帯専用の引き絵。
// 最小倍率イラストと同じ中心点から、表示サイズを55%に縮小し、
// zoom=16（1px≈2.4m換算）基準で西に100px・北に30px移動している
// （北50px移動後、さらに南に20px移動＝差し引き北30px）。
// 反時計回りに12.5度回転させているが、Leaflet の ImageOverlay は zoom/pan の
// たびに img 要素の style.transform（translate3d）を丸ごと上書きするため、
// CSS の transform: rotate() では反映されない。そのため画像ファイル自体を
// あらかじめ12.5度回転済み（余白を透過で拡張）にしてあり、bounds もその
// 拡張分（拡大率 ×1.1929）だけ広げて同じ実寸で表示されるようにしている。
// bounds は元画像が正方形（4096×4096）であることに合わせ、実距離（メートル
// 換算）で正方形になるよう経度方向の幅を緯度方向の1/cos(緯度)倍にしている
// （経度は同じ度数でも物理的な距離が緯度分だけ短いため）。これをしないと
// 縦横で伸縮率が変わり、回転した正方形が平行四辺形に歪んで見える。
// （実地図との目視確認はまだのため、表示を見ながら追加調整が必要な場合がある）。
const NEXT_ZOOM_ILLUSTRATION_CONFIG: BackgroundConfig = {
  enabled: true,
  imagePath: '/images/maps/background/sunday-market-zoom-2.webp',
  bounds: [
    [33.56854086425856, 133.54526352489341],
    [33.55587675701344, 133.53006584798584],
  ],
  opacity: 0.7,
  zIndex: 16,
};

/** 背景イラストの表示ズーム帯。null は「どちらも表示しない」。 */
export type BackgroundZoomBucket = 'min' | 'next' | null;

interface BackgroundOverlayProps {
  /**
   * 表示する背景イラストのズーム帯。
   * `isMinimumZoomMode`（ランドマーク・ラベル・道路オーバーレイ等、他の挙動を
   * まとめて切り替える共有フラグ）とは意図的に独立させている。この背景イラスト
   * だけの表示ズーム範囲を、他の挙動に影響を与えずに調整できるようにするため。
   */
  zoomBucket: BackgroundZoomBucket;
}

export default function BackgroundOverlay({ zoomBucket }: BackgroundOverlayProps) {
  const activeConfig =
    zoomBucket === 'min'
      ? MIN_ZOOM_ILLUSTRATION_CONFIG
      : zoomBucket === 'next'
      ? NEXT_ZOOM_ILLUSTRATION_CONFIG
      : null;

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
      {activeConfig?.enabled && activeConfig.imagePath && (
        <ImageOverlay
          key={zoomBucket}
          url={activeConfig.imagePath}
          bounds={activeConfig.bounds as LatLngBoundsExpression}
          opacity={activeConfig.opacity}
          zIndex={activeConfig.zIndex}
        />
      )}
    </>
  );
}
