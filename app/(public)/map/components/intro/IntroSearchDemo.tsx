'use client';

/**
 * 「ジャンルでしぼる」のデモ。
 *
 * マップ上部のジャンルチップ（MapPageClient の GenreFilter）を縮めたもの。
 * 押すと本番と同じことが起きる。
 *   当てはまった店 … 写真と店名のカードで大きく前に出る（ShopScanCards）
 *   外れた店       … 沈んで色が抜ける（map-search-spotlight-mode と同じ落とし方）
 * カードをタップすれば、地図のときと同じくバナーが全開で開く（開くのは親の
 * MapIntroPanel。案内全体の上に開くので、ここは押された店を伝えるだけ）。
 *
 * 検索バーとお気に入りの絞り込みは、ここでは触っても動かせない（文字を打つ先も、
 * お気に入りに入れた店も無い）ので置いていない。押せそうに見えて動かないものを
 * 並べると、案内のつもりが最初の不信になる。
 */

import { useCallback, useMemo, useState } from 'react';
import {
  INTRO_CARD_HEIGHT,
  INTRO_CARD_WIDTH,
  IntroDemoFrame,
  IntroRoad,
  IntroScanCard,
  IntroStallMarker,
} from './IntroStall';
import type { IntroDemoShop } from './introDemoShops';

const DEFAULT_FRAME_HEIGHT = 320;

/** 6件を道の左右に3件ずつ。left は足元の位置 */
const STALL_SLOTS = [
  { side: 'south' as const, left: '32%', foot: '24%' },
  { side: 'north' as const, left: '68%', foot: '36%' },
  { side: 'south' as const, left: '32%', foot: '50%' },
  { side: 'north' as const, left: '68%', foot: '62%' },
  { side: 'south' as const, left: '32%', foot: '76%' },
  { side: 'north' as const, left: '68%', foot: '88%' },
];

export default function IntroSearchDemo({
  shops,
  categories,
  /** 画面が広いときは縦にもっと見せられる */
  frameHeight = DEFAULT_FRAME_HEIGHT,
  favoriteIds,
  selectedShopId,
  onSelectShop,
}: {
  shops: IntroDemoShop[];
  categories: readonly string[];
  frameHeight?: number;
  /** お気に入りの印が付いている店（案内全体で共通） */
  favoriteIds: number[];
  /** いまバナーが開いている店。屋台を選ばれた見た目にする */
  selectedShopId: number | null;
  onSelectShop: (shop: IntroDemoShop) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const placed = shops.slice(0, STALL_SLOTS.length);
  const matchCount = useMemo(
    () => (selected ? placed.filter((shop) => shop.category === selected).length : 0),
    [placed, selected]
  );

  const pickCategory = useCallback((category: string) => {
    setSelected((prev) => (prev === category ? null : category));
  }, []);

  return (
    <div className="space-y-3.5">
      {/* ジャンルチップ */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const active = selected === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => pickCategory(category)}
              aria-pressed={active}
              className={`rounded-full border px-3.5 py-1.5 text-[13px] font-bold shadow-sm transition active:scale-95 ${
                active
                  ? 'border-amber-400 bg-amber-400 text-white'
                  : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      <IntroDemoFrame height={frameHeight}>
        <IntroRoad bandWidth="78%" crowd={false}>
          {placed.map((shop, i) => {
            const slot = STALL_SLOTS[i];
            const matched = !selected || shop.category === selected;
            return (
              <div key={shop.id} className="absolute" style={{ left: slot.left, top: slot.foot }}>
                <IntroStallMarker
                  shop={shop}
                  side={slot.side}
                  scale={0.58}
                  state={{
                    selected: selectedShopId === shop.id,
                    favorite: favoriteIds.includes(shop.id),
                    highlighted: !!selected && matched,
                    dimmed: !!selected && !matched,
                  }}
                  onClick={() => onSelectShop(shop)}
                />
              </div>
            );
          })}

          {/* 当てはまった店は、本番と同じく写真と店名のカードで前に出す */}
          {selected &&
            placed.map((shop, i) => {
              if (shop.category !== selected) return null;
              const slot = STALL_SLOTS[i];
              return (
                <div
                  key={`card-${shop.id}`}
                  className="absolute"
                  style={{
                    left: slot.left,
                    top: slot.foot,
                    transform: `translate(-${INTRO_CARD_WIDTH / 2}px, -${INTRO_CARD_HEIGHT}px)`,
                    width: INTRO_CARD_WIDTH,
                    height: INTRO_CARD_HEIGHT,
                  }}
                >
                  <IntroScanCard shop={shop} onClick={() => onSelectShop(shop)} />
                </div>
              );
            })}
        </IntroRoad>
      </IntroDemoFrame>

      <p className="pt-1 text-center text-[11.5px] font-semibold text-nicchyo-ink/40">
        {selected
          ? `「${selected}」のお店が ${matchCount}件。写真と名前で前に出ます`
          : 'ジャンルを押すと、そのお店だけが地図に残ります'}
      </p>
    </div>
  );
}
