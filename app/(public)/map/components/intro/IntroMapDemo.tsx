'use client';

/**
 * 「地図で店を探す」のデモ。
 *
 * 説明で終わらせず、本番と同じ手順をその場で一度やってもらう。
 *   道を指でなぞって動かす → 動かしているあいだ写真と店名のカードが前に出る
 *   → 気になった店をタップ → バナーが全開で開く → ハートで印を付けると屋根に札が出る
 *
 * 屋台・カード・バナーはどれもマップ本体が使っている部品をそのまま呼んでいる。
 * 店名の木札を常時は出さないのも、探しているあいだだけカードを出すのも、
 * 本番の見せ方に合わせたもの（IntroStall.tsx の IntroStallMarker 参照）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import NextImage from 'next/image';
import { ChevronsUpDown } from 'lucide-react';
import IntroShopSheet from './IntroShopSheet';
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
const FRAME_HEIGHT = 460;
/** 道の全長。枠より長いぶんだけ指で動かせる */
const ROAD_HEIGHT = 1240;
/** 上下に置く余白（この中には屋台を置かない） */
const ROAD_PADDING = 70;
/** 同じ列の屋台どうしの間隔 */
const STALL_GAP = 140;
/** 動かし終わってからカードを残す時間。本番の ShopScanCards と同じ */
const HOLD_MS = 500;

/**
 * 16軒を道の左右に8軒ずつ、互い違いに並べる。
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

export default function IntroMapDemo({ shops }: { shops: IntroDemoShop[] }) {
  const [openShopId, setOpenShopId] = useState<number | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  /** 指で動かしているあいだと、その直後。本番と同じでカードはこのときだけ出す */
  const [scanning, setScanning] = useState(false);
  /** 一度でも動かしたら、うながしの吹き出しは引っ込める */
  const [hasPanned, setHasPanned] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  const slots = buildSlots(shops.length);
  const placed = shops.map((shop, i) => ({ shop, slot: slots[i] }));
  const openShop = shops.find((shop) => shop.id === openShopId) ?? null;

  useEffect(
    () => () => {
      if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    },
    []
  );

  const startScan = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setScanning(true);
    setHasPanned(true);
  }, []);

  const endScan = useCallback(() => {
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      setScanning(false);
    }, HOLD_MS);
  }, []);

  const toggleFavorite = useCallback((id: number) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  return (
    <IntroDemoFrame height={FRAME_HEIGHT}>
      {/* 指で上下に動かせる道。本番のパン操作にあたる */}
      <motion.div
        drag="y"
        dragConstraints={{ top: FRAME_HEIGHT - ROAD_HEIGHT, bottom: 0 }}
        dragElastic={0.06}
        dragMomentum
        onDragStart={startScan}
        onDragEnd={endScan}
        // 指の動きを案内パネル側へ流さない。流すと、道を下へ送ったつもりが
        // パネルの「いちばん上で下へ引く＝縮める」に食われてしまう
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
        className="absolute inset-x-0 top-0 cursor-grab touch-pan-x active:cursor-grabbing"
        style={{ height: ROAD_HEIGHT }}
      >
        <IntroRoad>
          {placed.map(({ shop, slot }) => (
            <div key={shop.id} className="absolute" style={{ left: slot.left, top: slot.top }}>
              <IntroStallMarker
                shop={shop}
                side={slot.side}
                scale={0.6}
                state={{
                  selected: openShopId === shop.id,
                  favorite: favoriteIds.includes(shop.id),
                }}
                onClick={() => setOpenShopId(shop.id)}
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
                <IntroScanCard shop={shop} onClick={() => setOpenShopId(shop.id)} />
              </div>
            ))}
          </div>
        </IntroRoad>
      </motion.div>

      {/* にちよさんのうながし。動かしたら引っ込む */}
      <AnimatePresence>
        {!hasPanned && !openShop && (
          <motion.div
            key="intro-map-hint"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute left-3 top-2.5 flex items-start gap-2"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nicchyo-accent/30 shadow-sm ring-1 ring-white/70">
              <NextImage
                src="/images/obaasan_transparent.png"
                alt="にちよさん"
                width={26}
                height={26}
                className="h-[26px] w-[26px]"
              />
            </span>
            <span className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white/95 px-3 py-2 text-[12.5px] font-semibold leading-snug text-nicchyo-ink shadow-md ring-1 ring-nicchyo-ink/10">
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              指で上下に動かして、通りを歩いてみいや
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 本番と同じ、下から全開まで開くバナー */}
      <AnimatePresence>
        {openShop && (
          <IntroShopSheet
            shop={openShop}
            isFavorite={favoriteIds.includes(openShop.id)}
            onToggleFavorite={() => toggleFavorite(openShop.id)}
            onClose={() => setOpenShopId(null)}
          />
        )}
      </AnimatePresence>
    </IntroDemoFrame>
  );
}
