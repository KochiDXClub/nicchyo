'use client';

/**
 * 「地図で店を探す」のデモ。
 *
 * 説明で終わらせず、本番と同じ手順をその場で一度やってもらう。
 *   道を上下に動かす → 動かしているあいだ写真と店名のカードが前に出る
 *   → 気になった店を押す → バナーが全開で開く → ハートで印を付けると屋根に札が出る
 *
 * 道は「指でつかんで動かす」のではなく、普通のスクロールにしてある。
 * つかんで動かす作りだと、上下の指の動きをこの枠が全部持っていってしまい、
 * スマホで案内の続きへスクロールできなくなる（端まで来ても外へ渡らない）。
 * 普通のスクロールなら、端に着いたところで外のスクロールへ自然に渡る。
 *
 * 屋台・カードはどれもマップ本体が使っている部品をそのまま呼んでいる。
 * 店名の木札を常時は出さないのも、探しているあいだだけカードを出すのも、
 * 本番の見せ方に合わせたもの（IntroStall.tsx の IntroStallMarker 参照）。
 *
 * 押した店のバナーはここでは開かない。デモの枠の中に収めると写真と見出しで
 * 切れてしまうので、親（MapIntroPanel）が案内全体の上に開く。ここは
 * 「どの店が押されたか」を伝え、選ばれている店とお気に入りの印を受け取って描くだけ。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronsUpDown } from 'lucide-react';
import {
  INTRO_CARD_HEIGHT,
  INTRO_CARD_WIDTH,
  IntroDemoFrame,
  IntroRoad,
  IntroScanCard,
  IntroStallMarker,
} from './IntroStall';
import type { IntroDemoShop } from './introDemoShops';

/** スマホでマップページを開いたときと同じくらいの、縦に長い画面 */
const DEFAULT_FRAME_HEIGHT = 460;
/**
 * 道の全長。枠より長いぶんだけ動かせる。
 * 6軒（左右3軒ずつ）が収まり、枠の高さより少しだけ長い程度にとどめる。
 * 長すぎると、動かす体験というより「抜けるまで送り続ける」作業になる
 */
const ROAD_HEIGHT = 620;
/** 上下に置く余白（この中には屋台を置かない） */
const ROAD_PADDING = 90;
/** 同じ列の屋台どうしの間隔 */
const STALL_GAP = 150;
/** 動かし終わってからカードを残す時間。本番の ShopScanCards と同じ */
const HOLD_MS = 500;

/**
 * 6軒を道の左右に3軒ずつ、互い違いに並べる。
 * left は足元の位置、side は木札の出る向き（本番と同じで道の外側へ出る）。
 * 真ん中の通路（枠の 39%〜61%）は空けておく。
 */
function buildSlots(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const isLeft = i % 2 === 0;
    return {
      side: (isLeft ? 'south' : 'north') as 'south' | 'north',
      left: isLeft ? '32%' : '68%',
      top: ROAD_PADDING + Math.floor(i / 2) * STALL_GAP + (isLeft ? 0 : STALL_GAP / 2),
    };
  });
}

export default function IntroMapDemo({
  shops,
  /** 画面が広いときは縦にもっと見せられる */
  frameHeight = DEFAULT_FRAME_HEIGHT,
  favoriteIds,
  selectedShopId,
  onSelectShop,
}: {
  shops: IntroDemoShop[];
  frameHeight?: number;
  /** お気に入りの印が付いている店（案内全体で共通） */
  favoriteIds: number[];
  /** いまバナーが開いている店。屋台を選ばれた見た目にする */
  selectedShopId: number | null;
  onSelectShop: (shop: IntroDemoShop) => void;
}) {
  /** 指で動かしているあいだと、その直後。本番と同じでカードはこのときだけ出す */
  const [scanning, setScanning] = useState(false);
  /** 一度でも動かしたら、うながしの吹き出しは引っ込める */
  const [hasPanned, setHasPanned] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const roadRef = useRef<HTMLDivElement | null>(null);

  const slots = buildSlots(shops.length);
  const placed = shops.map((shop, i) => ({ shop, slot: slots[i] }));

  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    },
    []
  );

  /**
   * 動かしているあいだはカードを出し、止まってからも少しのあいだ残す。
   * 止まった瞬間に消すと「動いている絵しか読めない」ことになるので、
   * 静止画で読める時間を作る（本番の ShopScanCards と同じ考え方）。
   */
  const handleRoadScroll = useCallback(() => {
    setScanning(true);
    setHasPanned(true);
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setScanning(false);
    }, HOLD_MS);
  }, []);

  return (
    <IntroDemoFrame height={frameHeight}>
      {/* 上下に動かせる道。本番のパン操作にあたる */}
      <div
        ref={roadRef}
        onScroll={handleRoadScroll}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
      >
        <div className="relative w-full" style={{ height: ROAD_HEIGHT }}>
          <IntroRoad>
            {placed.map(({ shop, slot }) => (
              <div key={shop.id} className="absolute" style={{ left: slot.left, top: slot.top }}>
                <IntroStallMarker
                  shop={shop}
                  side={slot.side}
                  scale={0.6}
                  state={{
                    selected: selectedShopId === shop.id,
                    favorite: favoriteIds.includes(shop.id),
                  }}
                  onClick={() => onSelectShop(shop)}
                />
              </div>
            ))}

            {/* 探しているあいだだけ、屋台の上に写真と店名を重ねる（本番の ShopScanCards） */}
            <div
              className={`absolute inset-0 transition-opacity duration-300 ${
                scanning ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {placed.map(({ shop, slot }) => (
                <div
                  key={shop.id}
                  className="absolute"
                  style={{
                    left: slot.left,
                    top: slot.top,
                    transform: `translate(-${INTRO_CARD_WIDTH / 2}px, -${INTRO_CARD_HEIGHT}px)`,
                    width: INTRO_CARD_WIDTH,
                    height: INTRO_CARD_HEIGHT,
                  }}
                >
                  <IntroScanCard shop={shop} onClick={() => onSelectShop(shop)} />
                </div>
              ))}
            </div>
          </IntroRoad>
        </div>
      </div>

      {/*
        動かせることの合図。案内の言葉はレールのにちよさんが言うので（案内全体で
        にちよさんの絵は1枚だけ）、ここは形だけの小さな印にとどめる。
      */}
      <AnimatePresence>
        {!hasPanned && selectedShopId === null && (
          <motion.div
            key="intro-map-hint"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            // 動かし始めたら即座に消す。ゆっくり消すと、出てきた写真カードの上に重なる
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-[11.5px] font-bold text-nicchyo-ink/70 shadow-sm ring-1 ring-nicchyo-ink/10"
          >
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
            上下に動かせます
          </motion.div>
        )}
      </AnimatePresence>
    </IntroDemoFrame>
  );
}
