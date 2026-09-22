'use client';

/**
 * 案内パネルのデモで使う、地図の部品。
 *
 * マーカーの HTML は本番と同じ markerHtmlGenerator から、探しているときのカードは
 * ShopScanCards と同じ形から、道の色は roadStyle.ts から、人影は crowdParts.ts から
 * 引いている。こうしておくと、屋台の絵や色分けを直したとき案内も一緒に変わる。
 *
 * 違うのは「地図が座標から位置を決める」代わりに、割合や px で置いているところだけ。
 */

import { useMemo } from 'react';
import { ROAD_STYLE } from '../../config/roadStyle';
import { getShopBannerImage } from '@/lib/shopImages';
import { generateShopMarkerHtml, sanitizeCssColor } from '../../utils/markerHtmlGenerator';
import { resolveStallColors } from '../../config/shopCategories';
import { generateCrowdSvg, CROWD_KINDS } from '../../config/crowdParts';
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
  onClick,
}: {
  shop: Shop;
  /** 道のどちら側に置くか。木札の向きが変わる（本番と同じ shop-side-*） */
  side: 'north' | 'south';
  state?: IntroStallState;
  /** 枠が小さいので、本番の 60px から少し縮める */
  scale?: number;
  onClick?: () => void;
}) {
  /**
   * 木札（店名）は選ばれた店にだけ出す。
   *
   * 本番の MapLibre 版が同じ規則で出している（LAYER_SHOP_NAMEPLATES の filter が
   * state=selected のみ）。通りを流し見しているときに答えになるのは写真のほうで、
   * 全店に出すと道の外へ伸びた札が画面端で切れ、静止時の地図が文字で埋まるため。
   * 探しているあいだは IntroScanCard が写真ごと前に出す。
   */
  const lod = state.selected ? 'nameplate' : 'photo';

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

/** ScanCards と同じ寸法（components/ShopScanCards.tsx の CARD_WIDTH / getCardHeight） */
export const INTRO_CARD_WIDTH = 108;
export const INTRO_CARD_HEIGHT = 72;

/**
 * 探しているときに屋台の上へ重なる、写真中心のカード。
 *
 * 本番は地図を動かしているあいだと、検索・AI で対象が絞れているときに出る
 * （ShopScanCards）。寸法・角丸・縁と影・店名の帯まで同じにしてある。
 */
export function IntroScanCard({ shop, onClick }: { shop: Shop; onClick?: () => void }) {
  const roof = resolveStallColors(shop.category, sanitizeCssColor(shop.illustration?.color));
  const photo = shop.images?.main ?? getShopBannerImage(shop.category, shop.position ?? shop.id);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${shop.name}を開く`}
      className="nicchyo-scan-card absolute left-0 top-0 block overflow-hidden rounded-[14px] border-0 p-0"
      style={{
        width: INTRO_CARD_WIDTH,
        height: INTRO_CARD_HEIGHT,
        backgroundColor: roof.light,
        boxShadow: `0 0 0 2px ${roof.dark}, 0 5px 14px rgba(58,58,58,0.26)`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element --
          本番の ShopScanCards と同じく、付け外しの多い小さな webp を素の img で出す */}
      <img
        src={photo}
        alt=""
        decoding="async"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {shop.name ? (
        <span
          className="absolute inset-x-0 bottom-0 block truncate px-[7px] py-[3px] text-left text-[10.5px] font-bold leading-[13px] tracking-[0.01em] text-white"
          style={{ backgroundColor: roof.dark }}
        >
          {shop.name}
        </span>
      ) : null}
    </button>
  );
}

/** 道の上のお客さん。置き場所は見た目だけの固定値（本番はシード付きで散らす） */
const CROWD = [
  { kind: 0, left: '44%', top: '7%', flip: false },
  { kind: 3, left: '55%', top: '16%', flip: true },
  { kind: 2, left: '47%', top: '27%', flip: false },
  { kind: 6, left: '56%', top: '38%', flip: true },
  { kind: 1, left: '45%', top: '49%', flip: false },
  { kind: 7, left: '54%', top: '60%', flip: true },
  { kind: 4, left: '46%', top: '71%', flip: false },
  { kind: 5, left: '55%', top: '82%', flip: true },
  { kind: 0, left: '47%', top: '93%', flip: true },
];

const CROWD_SIZE = { width: 13, height: 22 };

/**
 * 道。真ん中のグレーが通路、その両脇の暖色が屋台の並ぶ帯。
 * 「真ん中を歩けばいい」が色で分かる、という本番の塗り分けをそのまま縮めたもの。
 *
 * 向きは縦。本番のマップも追手筋を画面の上下に通して見せているので、
 * スマホで見たときと同じ向きになる。
 *
 * 通路には人影を置く（本番の crowd フラグが sprite のときと同じ絵）。
 * 道の外にはうっすら建物を置く。どちらも無いと、道がただの帯に見えてしまう。
 */
export function IntroRoad({
  children,
  bandWidth = '74%',
  crowd = true,
}: {
  children?: React.ReactNode;
  /** 枠に対する道の幅 */
  bandWidth?: string;
  /** 人影を出すか */
  crowd?: boolean;
}) {
  return (
    // isolate は必須。選ばれた屋台には本番の CSS が z-index: 1000 を付ける
    // （.shop-marker-selected）。本番では Leaflet のマーカー層の中の話だが、
    // ここでは道を積み重ねの単位にしておかないと、屋台が後から開くバナーより
    // 手前に浮いて、バナーの写真の上に屋台と木札が乗る
    <div
      className="absolute inset-0 isolate overflow-hidden"
      style={{ backgroundColor: '#ece5d8' }}
    >
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
        className="absolute inset-y-0 left-1/2 -translate-x-1/2"
        style={{
          width: bandWidth,
          backgroundColor: ROAD_STYLE.surfaceColor,
          borderLeft: `1.5px solid ${ROAD_STYLE.edgeColor}`,
          borderRight: `1.5px solid ${ROAD_STYLE.edgeColor}`,
        }}
      >
        {/* 中央の通路（アスファルトが見えているところ） */}
        <div
          className="absolute inset-y-0 left-1/2 -translate-x-1/2"
          style={{ width: '30%', backgroundColor: ROAD_STYLE.corridorColor }}
        >
          {/* 中央線 */}
          <div
            className="absolute inset-y-0 left-1/2 -translate-x-1/2"
            style={{
              width: '2px',
              opacity: ROAD_STYLE.laneOpacity,
              backgroundImage: `repeating-linear-gradient(to bottom, ${ROAD_STYLE.laneColor} 0 14px, transparent 14px 26px)`,
            }}
          />
        </div>
      </div>

      {crowd && (
        <div className="absolute inset-0" aria-hidden>
          {CROWD.map((person, i) => (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-full opacity-80"
              style={{ left: person.left, top: person.top }}
              dangerouslySetInnerHTML={{
                __html: generateCrowdSvg(CROWD_KINDS[person.kind], i % 2, person.flip, CROWD_SIZE),
              }}
            />
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

/** 道の外（左右）に置く街区。位置は見た目だけの固定値 */
const BUILDINGS = [
  { left: '1%', top: '4%', w: '7%', h: '9%' },
  { left: '0%', top: '18%', w: '6%', h: '7%' },
  { left: '1.5%', top: '31%', w: '7%', h: '11%' },
  { left: '0%', top: '48%', w: '6%', h: '8%' },
  { left: '1%', top: '61%', w: '7%', h: '8%' },
  { left: '0.5%', top: '75%', w: '6%', h: '10%' },
  { left: '1%', top: '90%', w: '7%', h: '7%' },
  { left: '92%', top: '2%', w: '7%', h: '8%' },
  { left: '93%', top: '15%', w: '6%', h: '11%' },
  { left: '91.5%', top: '32%', w: '7%', h: '7%' },
  { left: '93%', top: '45%', w: '6%', h: '10%' },
  { left: '92%', top: '60%', w: '7%', h: '8%' },
  { left: '93%', top: '73%', w: '6%', h: '9%' },
  { left: '92%', top: '88%', w: '7%', h: '8%' },
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
