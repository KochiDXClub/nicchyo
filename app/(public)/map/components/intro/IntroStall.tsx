'use client';

/**
 * 案内パネルのデモで使う、地図の部品。
 *
 * マーカーの HTML は本番と同じ markerHtmlGenerator から作り、クラス名も
 * 本番（OptimizedShopLayerWithClustering が組み立てるもの）と同じにしている。
 * 道の色も roadStyle.ts の値をそのまま引く。
 * こうしておくと、屋台の絵や木札や色分けを直したとき案内も一緒に変わる。
 *
 * 違うのは「Leaflet が座標から位置を決める」代わりに、割合で置いているところだけ。
 */

import { useMemo } from 'react';
import { ROAD_STYLE } from '../../config/roadStyle';
import { getShopBannerImage } from '@/lib/shopImages';
import { generateShopMarkerHtml } from '../../utils/markerHtmlGenerator';
import type { Shop } from '../../types/shopData';

/** デモの屋台の状態。本番のマーカー状態クラスに対応する */
export type IntroStallState = {
  /** タップで開いている（本番の shop-marker-selected） */
  selected?: boolean;
  /** 検索で絞り込まれて残っている（本番の shop-marker-search） */
  highlighted?: boolean;
  /** 検索で外れた。本番の map-search-spotlight-mode と同じ落とし方 */
  dimmed?: boolean;
  /** お気に入りに入れた（本番の is-favorite。屋根の上にハートの札が出る） */
  favorite?: boolean;
};

export function IntroStallMarker({
  shop,
  side,
  state = {},
  scale = 1,
  lod = 'nameplate',
  onClick,
}: {
  shop: Shop;
  /** 道のどちら側に置くか。木札の向きが変わる（本番と同じ shop-side-*） */
  side: 'north' | 'south';
  state?: IntroStallState;
  /** 枠が小さいので、本番の 60px から少し縮める */
  scale?: number;
  /**
   * どこまで描くか（本番の LOD）。
   * nameplate は木札まで、photo は屋根の上の写真まで。
   * 屋台を詰めて並べる枠では、本番が引いたときにそうするのと同じく photo にする
   */
  lod?: 'photo' | 'nameplate';
  onClick?: () => void;
}) {
  const html = useMemo(
    () =>
      generateShopMarkerHtml(shop, {
        bannerImage: getShopBannerImage(shop.category, shop.id),
        illustrationSize: 'medium',
        includeNameplate: lod === 'nameplate',
      }),
    [shop, lod]
  );

  const classNames = [
    'custom-shop-marker',
    `shop-side-${side}`,
    `shop-lod-${lod}`,
    state.favorite ? 'is-favorite' : '',
    state.selected ? 'shop-marker-selected' : '',
    state.highlighted ? 'shop-marker-search' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${shop.name}を開く`}
      className={`${classNames} absolute -translate-x-1/2 -translate-y-full appearance-none border-0 bg-transparent p-0 transition-[opacity,filter] duration-300`}
      style={{
        // 本番は地図のズームで決まる値。デモは枠に収まる倍率を固定で入れる
        ['--shop-marker-zoom-scale' as string]: String(scale),
        opacity: state.dimmed ? 0.25 : 1,
        filter: state.dimmed ? 'saturate(0.15)' : undefined,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/**
 * 道。真ん中のグレーが通路、その両脇の暖色が屋台の並ぶ帯。
 * 「真ん中を歩けばいい」が色で分かる、という本番の塗り分けをそのまま縮めたもの。
 *
 * 道の外にはうっすら建物を置く。本番はここにベースマップの街が見えているので、
 * 何も描かないと道の上下がただの余白に見えてしまう。
 */
export function IntroRoad({
  children,
  /** 枠に対する道の高さ。屋台を何段置くかで変える */
  bandHeight = '82%',
}: {
  children?: React.ReactNode;
  bandHeight?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: '#ece5d8' }}>
      {/* 道の外の街。形だけの控えめな塊にして、道から視線を奪わない */}
      <div className="absolute inset-0" aria-hidden>
        {BUILDINGS.map((b, i) => (
          <span
            key={i}
            className="absolute rounded-[3px]"
            style={{ left: b.left, top: b.top, width: b.w, height: b.h, backgroundColor: '#e0d7c6' }}
          />
        ))}
      </div>

      {/* 屋台が並ぶ帯 */}
      <div
        className="absolute inset-x-0 top-1/2 -translate-y-1/2"
        style={{
          height: bandHeight,
          backgroundColor: ROAD_STYLE.surfaceColor,
          borderTop: `1.5px solid ${ROAD_STYLE.edgeColor}`,
          borderBottom: `1.5px solid ${ROAD_STYLE.edgeColor}`,
        }}
      >
        {/* 中央の通路（アスファルトが見えているところ） */}
        <div
          className="absolute inset-x-0 top-1/2 -translate-y-1/2"
          style={{ height: '30%', backgroundColor: ROAD_STYLE.corridorColor }}
        >
          {/* 中央線 */}
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2"
            style={{
              height: '2px',
              opacity: ROAD_STYLE.laneOpacity,
              backgroundImage: `repeating-linear-gradient(to right, ${ROAD_STYLE.laneColor} 0 14px, transparent 14px 26px)`,
            }}
          />
        </div>
      </div>
      {children}
    </div>
  );
}

/** 道の外に置く街区。位置は見た目だけの固定値 */
const BUILDINGS = [
  { left: '4%', top: '1%', w: '18%', h: '7%' },
  { left: '26%', top: '0%', w: '12%', h: '6%' },
  { left: '44%', top: '1.5%', w: '22%', h: '6%' },
  { left: '72%', top: '0%', w: '16%', h: '7%' },
  { left: '8%', top: '92%', w: '14%', h: '7%' },
  { left: '30%', top: '93%', w: '20%', h: '6%' },
  { left: '58%', top: '92%', w: '13%', h: '7%' },
  { left: '77%', top: '93.5%', w: '18%', h: '6%' },
];

/** デモの枠。角丸と影だけを持つ器 */
export function IntroDemoFrame({
  children,
  height,
  className = '',
}: {
  children: React.ReactNode;
  height: number;
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl ring-1 ring-nicchyo-ink/10 ${className}`}
      style={{ height }}
    >
      {children}
    </div>
  );
}
