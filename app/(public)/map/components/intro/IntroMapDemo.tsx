'use client';

/**
 * 「地図で店を探す」のデモ。
 *
 * 通りに6軒が並び、写真と店名のカードが2秒ごとに1軒ずつ順に前へ出る。
 * 本番では通りを動かしているあいだだけカードが出るが、案内では読む人が
 * 何もしなくても「屋台を押すと何が見えるか」が伝わるよう、こちらから順に見せる。
 * 気になった店（屋台でもカードでも）を押すと、本番と同じバナーが全開で開く。
 *
 * 道は枠にぴったり収めて、上下に動かない。以前は枠より長い道を上下に動かす
 * 作りだったが、案内全体のスクロールと指の取り合いになり、動かしても
 * 「何をすればいいのか」が伝わりにくかった。
 *
 * 屋台・カードはどれもマップ本体が使っている部品をそのまま呼んでいる。
 * 店名の木札を常時は出さないのも本番の見せ方に合わせたもの
 * （IntroStall.tsx の IntroStallMarker 参照）。
 *
 * 押した店のバナーはここでは開かない。デモの枠の中に収めると写真と見出しで
 * 切れてしまうので、親（MapIntroPanel）が案内全体の上に開く。ここは
 * 「どの店が押されたか」を伝え、選ばれている店とお気に入りの印を受け取って描くだけ。
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
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
/** 写真と店名のカードを次の店へ回す間隔 */
const CYCLE_MS = 2000;

/**
 * 6軒を道の左右に3軒ずつ、互い違いに並べる（枠に対する割合）。
 * left は足元の横位置、top は足元の縦位置、side は木札の出る向き
 * （本番と同じで道の外側へ出る）。真ん中の通路（枠の 39%〜61%）は空けておく。
 * いちばん上の店でも、その上に出るカード（72px）が枠に収まる高さから始める
 */
const STALL_SLOTS = [
  { side: 'south' as const, left: '32%', top: '21%' },
  { side: 'north' as const, left: '68%', top: '33%' },
  { side: 'south' as const, left: '32%', top: '46%' },
  { side: 'north' as const, left: '68%', top: '58%' },
  { side: 'south' as const, left: '32%', top: '71%' },
  { side: 'north' as const, left: '68%', top: '83%' },
];

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
  const reduceMotion = useReducedMotion();
  const placed = shops.slice(0, STALL_SLOTS.length).map((shop, i) => ({ shop, slot: STALL_SLOTS[i] }));

  /** いまカードが前に出ている店（placed の添字） */
  const [activeIndex, setActiveIndex] = useState(0);
  // 2秒ごとに次の店へ。バナーが開いているあいだは止める（裏で回っても見えない）
  const paused = selectedShopId !== null || placed.length === 0;
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % placed.length);
    }, CYCLE_MS);
    return () => window.clearInterval(timer);
  }, [paused, placed.length]);

  const active = placed[activeIndex % Math.max(1, placed.length)];

  return (
    <IntroDemoFrame height={frameHeight}>
      {/* 枠にぴったり収めた通り。上下には動かない */}
      <div className="absolute inset-0">
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

          {/*
            写真と店名のカード（本番の ShopScanCards）を、2秒ごとに1軒ずつ順に出す。
            位置は外の div、出入りの動きは中の motion.div。同じ要素に両方を
            置くと transform を取り合う
          */}
          <AnimatePresence initial={false}>
            {active && (
              <div
                key={active.shop.id}
                className="absolute"
                style={{
                  left: active.slot.left,
                  top: active.slot.top,
                  transform: `translate(-${INTRO_CARD_WIDTH / 2}px, -${INTRO_CARD_HEIGHT}px)`,
                  width: INTRO_CARD_WIDTH,
                  height: INTRO_CARD_HEIGHT,
                }}
              >
                <motion.div
                  className="h-full w-full will-change-transform"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.96 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                >
                  <IntroScanCard shop={active.shop} onClick={() => onSelectShop(active.shop)} />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </IntroRoad>
      </div>
    </IntroDemoFrame>
  );
}
