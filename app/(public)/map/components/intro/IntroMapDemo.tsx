'use client';

/**
 * 「地図で店を探す」のデモ。
 *
 * 説明で終わらせず、その場で一度やってもらう。
 *   屋台をタップ → 本番と同じバナーが下からせり上がる → ハートで印を付けると屋根に札が出る
 * バナーは ShopBannerHero の compact、屋台は markerHtmlGenerator と、
 * どちらもマップ本体が使っているものをそのまま呼んでいる。
 */

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Heart, X as XIcon } from 'lucide-react';
import NextImage from 'next/image';
import { ShopBannerHero, resolveBannerTheme } from '../ShopBannerHero';
import { getShopBannerImage } from '@/lib/shopImages';
import { IntroDemoFrame, IntroRoad, IntroStallMarker } from './IntroStall';
import type { IntroDemoShop } from './introDemoShops';

/** スマホでマップページを開いたときと同じくらいの、縦に長い画面 */
const FRAME_HEIGHT = 460;

/**
 * 屋台の置き場所（枠に対する割合）。
 *
 * 道は縦に通っているので、屋台は左右の列に分かれて上から順に並ぶ。
 * left は足元の位置、side は木札の出る向き（本番と同じで道の外側へ出る）。
 * 真ん中の通路（枠の 39%〜61%）は空けておく。
 */
const STALL_SLOTS = [
  { side: 'south' as const, left: '33%', foot: '22%' },
  { side: 'north' as const, left: '67%', foot: '33%' },
  { side: 'south' as const, left: '33%', foot: '47%' },
  { side: 'north' as const, left: '67%', foot: '58%' },
  { side: 'south' as const, left: '33%', foot: '72%' },
];

export default function IntroMapDemo({ shops }: { shops: IntroDemoShop[] }) {
  const [openShopId, setOpenShopId] = useState<number | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<number[]>([]);
  /** 一度でもタップされたら、うながしの吹き出しは引っ込める */
  const [hasTapped, setHasTapped] = useState(false);

  const placed = shops.slice(0, STALL_SLOTS.length);
  const openShop = placed.find((shop) => shop.id === openShopId) ?? null;

  const handleStallClick = useCallback((id: number) => {
    setHasTapped(true);
    setOpenShopId((prev) => (prev === id ? null : id));
  }, []);

  const toggleFavorite = useCallback((id: number) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  return (
    <IntroDemoFrame height={FRAME_HEIGHT}>
      <IntroRoad>
        {placed.map((shop, i) => {
          const slot = STALL_SLOTS[i];
          return (
            <div
              key={shop.id}
              className="absolute"
              style={{ left: slot.left, top: slot.foot }}
            >
              <IntroStallMarker
                shop={shop}
                side={slot.side}
                scale={0.6}
                state={{
                  selected: openShopId === shop.id,
                  favorite: favoriteIds.includes(shop.id),
                }}
                onClick={() => handleStallClick(shop.id)}
              />
              {/* 最初の1件だけ、タップできることが分かるように脈打たせる */}
              {i === 0 && !hasTapped && (
                <span
                  className="pointer-events-none absolute left-0 top-0 -translate-x-1/2 animate-ping rounded-full bg-nicchyo-primary/60"
                  style={{ width: 30, height: 30, marginTop: -34 }}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </IntroRoad>

      {/* にちよさんのうながし。タップしたら引っ込む */}
      <AnimatePresence>
        {!hasTapped && (
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
            <span className="rounded-2xl rounded-tl-sm bg-white/95 px-3 py-2 text-[12.5px] font-semibold leading-snug text-nicchyo-ink shadow-md ring-1 ring-nicchyo-ink/10">
              気になる屋台をタップしてみいや
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 本番と同じ、下からせり上がるバナー（マップの店舗バナーの畳んだ状態） */}
      <AnimatePresence>
        {openShop && (
          <motion.div
            key={`intro-banner-${openShop.id}`}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            className="absolute inset-x-0 bottom-0 border-t border-slate-100 bg-white px-4 pb-3 pt-2 shadow-[0_-8px_24px_-12px_rgba(15,23,42,0.4)]"
          >
            <div className="flex justify-center">
              <span className="h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
            </div>

            <div className="absolute right-3 top-3 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => toggleFavorite(openShop.id)}
                aria-pressed={favoriteIds.includes(openShop.id)}
                aria-label={
                  favoriteIds.includes(openShop.id) ? 'お気に入りから外す' : 'お気に入りに入れる'
                }
                className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition active:scale-95 ${
                  favoriteIds.includes(openShop.id)
                    ? 'bg-favorite-fg text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Heart
                  className="h-4 w-4"
                  fill={favoriteIds.includes(openShop.id) ? 'currentColor' : 'none'}
                />
              </button>
              <button
                type="button"
                onClick={() => setOpenShopId(null)}
                aria-label="閉じる"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-1">
              <ShopBannerHero
                shop={openShop}
                bannerImage={getShopBannerImage(openShop.category, openShop.id)}
                theme={resolveBannerTheme(openShop.themeColor)}
                heroImageError={false}
                onImageError={() => {}}
                mode="compact"
                showProductPreview
              />
            </div>

            <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">
              {favoriteIds.includes(openShop.id)
                ? 'ハートを押すと屋根に印が付きます。地図でも探しやすくなります'
                : 'ハートを押すと、あとからまとめて見られます'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </IntroDemoFrame>
  );
}
