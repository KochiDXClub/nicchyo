'use client';

/**
 * GuideNavigationBar
 *
 * 「案内中」の画面上部カード。目的地・残り時間・いまの指示・次の指示を出す。
 * 下辺の細いバーが進み具合（出発時の距離に対する残り）を示し、
 * 目的地の近くで「着きました」に変わる。
 *
 * 目的地に写真があれば見出しの横に小さく出す。「くわしく」を押したときは、
 * 下に別のカードを重ねず、このカード自体が下へ伸びて中身を見せる。
 * 案内中に画面の物が増えると、どれを見ればよいのか分からなくなるため。
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, MapPin, Navigation, X as XIcon } from 'lucide-react';
import type { RankedSpot } from '@/lib/guide';
import { formatDistance } from '@/lib/facilities/nearest';

type GuideNavigationBarProps = {
  target: RankedSpot;
  originLabel: string;
  arrived: boolean;
  /** 0〜1。出発時の距離に対してどれだけ歩いたか */
  progress: number;
  onStop: () => void;
};

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2';

export default function GuideNavigationBar({ target, originLabel, arrived, progress, onStop }: GuideNavigationBarProps) {
  const [expanded, setExpanded] = useState(false);
  const spot = target.spot;
  const route = target.route;
  // 先頭の「出発」は飛ばし、実際に歩く指示から見せる
  const walkSteps = (route?.steps ?? []).filter((step) => step.kind !== 'depart');
  const current = walkSteps[0];
  const next = walkSteps[1];
  const accent = target.spot.accentColor;
  const percent = Math.round(Math.min(1, Math.max(0, arrived ? 1 : progress)) * 100);

  return (
    <div
      className="absolute left-3 right-3 top-3 z-[1001] overflow-hidden rounded-[22px] bg-white shadow-[0_8px_24px_rgba(58,58,58,0.18)] ring-1 ring-black/5"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 px-4 pt-3">
        {/* 写真があれば見出しの先頭に置き、無ければ従来どおり矢印のしるし */}
        {spot.photoUrl ? (
          <span className="h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-slate-100" aria-hidden>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={spot.photoUrl} alt="" className="h-full w-full object-cover" loading="lazy" draggable={false} />
          </span>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }} aria-hidden>
            <Navigation size={16} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-none text-slate-500">{arrived ? '到着' : `${originLabel}から`}</p>
          <p className="mt-1 truncate text-[15px] font-black leading-tight tracking-tight text-nicchyo-ink">{spot.name}</p>
        </div>
        {route && !arrived && (
          <div className="shrink-0 text-right tabular-nums">
            <p className="text-[22px] font-black leading-none text-nicchyo-ink">
              {route.walkMinutes}
              <span className="ml-0.5 text-[12px] font-bold">分</span>
            </p>
            <p className="mt-1 text-[11px] leading-none text-slate-500">あと{formatDistance(route.distanceMeters)}</p>
          </div>
        )}
        <button
          type="button"
          onClick={onStop}
          aria-label="案内をやめる"
          className={`${FOCUS_RING} ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200`}
        >
          <XIcon size={16} />
        </button>
      </div>

      <div className="px-4 pb-3 pt-2.5">
        {arrived ? (
          <p className="text-[14px] font-bold text-nicchyo-ink">{target.spot.name}に着きました</p>
        ) : current ? (
          <>
            <p className="text-[14px] font-bold leading-snug text-nicchyo-ink">{current.instruction}</p>
            {next && <p className="mt-1 text-[12px] leading-snug text-slate-500">つぎに {next.instruction}</p>}
          </>
        ) : null}
        <div className="mt-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            aria-expanded={expanded}
            className={`${FOCUS_RING} flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 active:bg-slate-200`}
          >
            スポットをくわしく
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
          {!arrived && <span className="text-[11px] tabular-nums text-slate-400">{percent}%</span>}
        </div>

        {/* くわしく：下に別のカードを重ねず、このカードが伸びて中を見せる */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-2.5 border-t border-slate-100 pt-2.5">
                {spot.photoUrl && (
                  <figure className="mb-2.5 overflow-hidden rounded-xl bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={spot.photoUrl}
                      alt={`${spot.name}の写真`}
                      className="aspect-[16/9] w-full object-cover"
                      loading="lazy"
                      draggable={false}
                    />
                    {spot.photoCredit && (
                      <figcaption className="px-2 py-1 text-[10px] leading-tight text-slate-400">{spot.photoCredit}</figcaption>
                    )}
                  </figure>
                )}
                {spot.description && (
                  <p className="text-[12.5px] leading-relaxed text-slate-700">{spot.description}</p>
                )}
                {spot.lines && spot.lines.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {spot.lines.map((line) => (
                      <span
                        key={line}
                        className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {line}
                      </span>
                    ))}
                  </div>
                )}
                {spot.tags && spot.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {spot.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
                        style={{ borderColor: `${accent}66`, color: accent }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {spot.notes && <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">{spot.notes}</p>}
                {/*
                  位置が実測で確認できていないスポットは、その場で探し回らせないよう先に断る。
                  列が無い環境では undefined になるので、明示的に false のときだけ出す
                */}
                {spot.verified === false && (
                  <p className="mt-2 flex items-start gap-1 text-[11px] leading-relaxed text-slate-400">
                    <MapPin size={12} className="mt-0.5 shrink-0" aria-hidden />
                    場所はおおよその位置です。現地の案内表示もあわせてご確認ください。
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 進み具合 */}
      <div className="h-1 w-full bg-slate-100" aria-hidden>
        <div className="h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%`, backgroundColor: accent }} />
      </div>
    </div>
  );
}
