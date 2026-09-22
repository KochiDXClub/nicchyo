'use client';

/**
 * 「検索でしぼる」のデモ。
 *
 * マップ上部の検索バーとジャンルチップ（MapPageClient の GenreFilter）を
 * そのまま縮めたもの。チップを押すと、本番と同じように該当しない屋台が
 * 沈んで（map-search-spotlight-mode と同じ落とし方）、残った件数がバーに出る。
 */

import { useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import { IntroDemoFrame, IntroRoad, IntroStallMarker } from './IntroStall';
import type { IntroDemoShop } from './introDemoShops';

const FRAME_HEIGHT = 208;

/**
 * 6件を道の両脇に3件ずつ。
 * 本番でも店が詰まって見える倍率では木札を出さない（LOD が photo）ので、
 * ここも写真までにして、札同士が重ならないようにしている。
 */
const STALL_SLOTS = [
  { side: 'north' as const, left: '18%', foot: '37%' },
  { side: 'north' as const, left: '50%', foot: '37%' },
  { side: 'north' as const, left: '82%', foot: '37%' },
  { side: 'south' as const, left: '26%', foot: '84%' },
  { side: 'south' as const, left: '58%', foot: '84%' },
  { side: 'south' as const, left: '90%', foot: '84%' },
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
      {/* 検索バー。絞り込み中は本番と同じく暖色に変わり、件数が出る */}
      <div
        className={`flex items-center gap-2 rounded-full px-4 py-2.5 shadow-sm ring-1 transition-all duration-200 ${
          selected
            ? 'bg-gradient-to-r from-amber-100/95 to-orange-50/95 ring-amber-400/50'
            : 'bg-white/90 ring-slate-900/10'
        }`}
      >
        <svg
          className="h-4 w-4 shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle cx="11" cy="11" r="6.5" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 16.5 20 20" />
        </svg>
        <span className="flex-1 text-sm text-slate-400">
          {selected ?? 'お店を検索…'}
        </span>
        {selected && (
          <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
            {matchCount}件
          </span>
        )}
      </div>

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
              className={`rounded-full border px-3 py-1.5 text-[12.5px] font-bold shadow-sm transition active:scale-95 ${
                active
                  ? 'border-amber-400 bg-amber-400 text-white'
                  : 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50'
              }`}
            >
              {category}
            </button>
          );
        })}
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-[12.5px] font-bold text-rose-500">
          <Heart className="h-3 w-3" />
          お気に入り
        </span>
      </div>

      <IntroDemoFrame height={FRAME_HEIGHT}>
        <IntroRoad bandHeight="74%">
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
          ? `「${selected}」のお店だけが残りました`
          : 'ジャンルを押すと、そのお店だけが地図に残ります'}
      </p>
    </div>
  );
}
