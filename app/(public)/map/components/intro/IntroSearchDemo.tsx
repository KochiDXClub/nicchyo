'use client';

/**
 * 「ジャンルでしぼる」のデモ。
 *
 * マップ上部のジャンルチップ（MapPageClient の GenreFilter）を縮めたもの。
 * 押すと、本番と同じように該当しない屋台が沈む（map-search-spotlight-mode と
 * 同じ落とし方）。
 *
 * 検索バーとお気に入りの絞り込みは、ここでは触っても動かせない（文字を打つ先も、
 * お気に入りに入れた店も無い）ので置いていない。押せそうに見えて動かないものを
 * 並べると、案内のつもりが最初の不信になる。
 */

import { useMemo, useState } from 'react';
import { IntroDemoFrame, IntroRoad, IntroStallMarker } from './IntroStall';
import type { IntroDemoShop } from './introDemoShops';

const FRAME_HEIGHT = 300;

/**
 * 6件を道の左右に3件ずつ。
 * 本番でも店が詰まって見える倍率では木札を出さない（LOD が photo）ので、
 * ここも写真までにして、札同士が重ならないようにしている。
 */
const STALL_SLOTS = [
  { side: 'south' as const, left: '33%', foot: '26%' },
  { side: 'north' as const, left: '67%', foot: '38%' },
  { side: 'south' as const, left: '33%', foot: '52%' },
  { side: 'north' as const, left: '67%', foot: '64%' },
  { side: 'south' as const, left: '33%', foot: '78%' },
  { side: 'north' as const, left: '67%', foot: '90%' },
];

export default function IntroSearchDemo({
  shops,
  categories,
}: {
  shops: IntroDemoShop[];
  categories: readonly string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const placed = shops.slice(0, STALL_SLOTS.length);
  const matchCount = useMemo(
    () => (selected ? placed.filter((shop) => shop.category === selected).length : 0),
    [placed, selected]
  );

  return (
    <div className="space-y-2">
      {/* ジャンルチップ */}
      <div className="flex flex-wrap gap-1.5">
        {categories.map((category) => {
          const active = selected === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setSelected(active ? null : category)}
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

      <IntroDemoFrame height={FRAME_HEIGHT}>
        <IntroRoad bandWidth="78%">
          {placed.map((shop, i) => {
            const slot = STALL_SLOTS[i];
            const matched = !selected || shop.category === selected;
            return (
              <div key={shop.id} className="absolute" style={{ left: slot.left, top: slot.foot }}>
                <IntroStallMarker
                  shop={shop}
                  side={slot.side}
                  scale={0.58}
                  lod="photo"
                  state={{ highlighted: !!selected && matched, dimmed: !!selected && !matched }}
                />
              </div>
            );
          })}
        </IntroRoad>
      </IntroDemoFrame>

      <p className="text-center text-[11px] font-semibold text-nicchyo-ink/40">
        {selected
          ? `「${selected}」のお店が ${matchCount}件 残りました`
          : 'ジャンルを押すと、そのお店だけが地図に残ります'}
      </p>
    </div>
  );
}
