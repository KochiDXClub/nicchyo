'use client';

/**
 * 案内パネルのデモで使う、地図の部品。
 *
 * 屋台の絵は本番の MapLibre と同じ描き起こし（stallSprites）から、探しているときのカードは
 * ShopScanCards と同じ形から、道の色は roadStyle.ts から、人影は crowdParts.ts から
 * 引いている。こうしておくと、屋台の絵や色分けを直したとき案内も一緒に変わる。
 *
 * 違うのは「地図が座標から位置を決める」代わりに、割合や px で置いているところだけ。
 */

import { useEffect, useState } from 'react';
import { ROAD_STYLE } from '../../config/roadStyle';
import { getShopBannerImage, getShopMapPhotoImage, getShopThumbnailImage } from '@/lib/shopImages';
import { escapeHtml, SHOP_FAVORITE_BADGE_HTML, sanitizeCssColor } from '../../utils/markerHtmlGenerator';
import { PHOTO_STALL_PX, rasterizeStallWithPhoto, type StallState } from '../maplibre/stallSprites';
import { STALL_PHOTO_HEIGHT_RATIO } from '../../config/stallParts';
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

/**
 * 本番の地図（MapLibre）と同じ写真入りの屋台を、同じ関数で描き起こす。
 * 本番の屋台は Leaflet 版の丸窓（写真の丸いバッジ）ではなく、写真を枠に入れた屋台の絵。
 * 写真の切り抜きと屋台の形は rasterizeStallWithPhoto に任せ、案内の絵が本番とずれないようにする。
 */
function IntroPhotoStall({ shop, state, scale }: { shop: Shop; state: StallState; scale: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const photo = getShopMapPhotoImage(shop, false);
    const thumb = getShopThumbnailImage(shop);
    rasterizeStallWithPhoto(shop, state, photo, PHOTO_STALL_PX, 2, photo !== thumb ? thumb : undefined)
      .then((data) => {
        if (cancelled) return;
        const canvas = document.createElement('canvas');
        canvas.width = data.width;
        canvas.height = data.height;
        canvas.getContext('2d')?.putImageData(data, 0, 0);
        setSrc(canvas.toDataURL('image/png'));
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shop, state]);

  // 高さは本番の PHOTO_STALL_PX に揃える。幅は屋根を削った比率で決まる
  const height = PHOTO_STALL_PX * scale;
  return (
    <span className="block" style={{ height, width: height / STALL_PHOTO_HEIGHT_RATIO }}>
      {src ? (
        // 描き起こした画像（data URL）なので素の img で出す
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" draggable={false} className="block h-full w-full" />
      ) : null}
    </span>
  );
}

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
  /** 枠が小さいので、本番の 84px から少し縮める */
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
  const showNameplate = Boolean(state.selected);
  // 本番と同じ状態の絵。選ばれた店は selected、検索で残った店は search
  const stallState: StallState = state.selected ? 'selected' : state.highlighted ? 'search' : 'normal';

  const classNames = [
    'custom-shop-marker',
    `shop-side-${side}`,
    showNameplate ? 'shop-lod-nameplate' : 'shop-lod-photo',
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
        opacity: state.dimmed ? 0.25 : 1,
        filter: state.dimmed ? 'saturate(0.15)' : undefined,
      }}
    >
      <span className="relative block">
        <IntroPhotoStall shop={shop} state={stallState} scale={scale} />
        {state.favorite ? (
          <span className="absolute right-0 top-0 block" dangerouslySetInnerHTML={{ __html: SHOP_FAVORITE_BADGE_HTML }} />
        ) : null}
        {showNameplate ? (
          <span className="shop-nameplate absolute left-1/2 top-full -translate-x-1/2">
            <span className="shop-nameplate-text">{escapeHtml(shop.name)}</span>
          </span>
        ) : null}
      </span>
    </button>
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
  const roof = resolveStallColors(shop.categoryKey ?? shop.category, sanitizeCssColor(shop.illustration?.color));
  const photo = shop.images?.main ?? getShopBannerImage(shop.categoryKey ?? shop.category, shop.position ?? shop.id);

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
 * 人影の絵は入力が固定なので、モジュールを読んだときに一度だけ作る。
 * 描画のたびに SVG 文字列を組み立て直すと、カードの出し入れなどで
 * 道が描き直されるたびに 9 体ぶんの文字列生成が走る
 */
const CROWD_HTML: readonly string[] = CROWD.map((person, i) =>
  generateCrowdSvg(CROWD_KINDS[person.kind], i % 2, person.flip, CROWD_SIZE)
);

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
              dangerouslySetInnerHTML={{ __html: CROWD_HTML[i] }}
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

/** スクロール枠の高さから、見出し・停留点・操作欄の余白を引いてデモを収める。 */
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
      style={{
        height,
        maxHeight: "max(220px, calc(100cqh - 170px - var(--intro-demo-controls, 0px)))",
      }}
    >
      {children}
    </div>
  );
}
