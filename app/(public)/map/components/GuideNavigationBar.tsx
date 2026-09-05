'use client';

/**
 * GuideNavigationBar
 *
 * 「案内中」の画面上部カード。目的地・残り時間・いまの指示・次の指示を出す。
 * 下辺の細いバーが進み具合（出発時の距離に対する残り）を示し、
 * 目的地の近くで「着きました」に変わる。
 */

import { Navigation, X as XIcon } from 'lucide-react';
import type { RankedSpot } from '@/lib/guide';
import { formatDistance } from '@/lib/facilities/nearest';

type GuideNavigationBarProps = {
  target: RankedSpot;
  originLabel: string;
  arrived: boolean;
  /** 0〜1。出発時の距離に対してどれだけ歩いたか */
  progress: number;
  onStop: () => void;
  onOpenDetail: () => void;
};

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2';

export default function GuideNavigationBar({ target, originLabel, arrived, progress, onStop, onOpenDetail }: GuideNavigationBarProps) {
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }} aria-hidden>
          <Navigation size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-none text-slate-500">{arrived ? '到着' : `${originLabel}から`}</p>
          <p className="mt-1 truncate text-[15px] font-black leading-tight tracking-tight text-nicchyo-ink">{target.spot.name}</p>
        </div>
        {route && !arrived && (
          <div className="shrink-0 text-right tabular-nums">
            <p className="text-[22px] font-black leading-none text-nicchyo-ink">
              {route.walkMinutes}
              <span className="ml-0.5 text-[12px] font-bold">分</span>
            </p>
            <p className="mt-1 text-[11px] leading-none text-slate-500">
              {route.approximate ? 'あと約' : 'あと'}
              {formatDistance(route.distanceMeters).replace('約', '')}
            </p>
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
        ) : (
          <p className="text-[12px] text-slate-500">道のりを計算しています</p>
        )}
        <div className="mt-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenDetail}
            className={`${FOCUS_RING} rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600 active:bg-slate-200`}
          >
            スポットをくわしく
          </button>
          {!arrived && <span className="text-[11px] tabular-nums text-slate-400">{percent}%</span>}
        </div>
      </div>

      {/* 進み具合 */}
      <div className="h-1 w-full bg-slate-100" aria-hidden>
        <div className="h-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%`, backgroundColor: accent }} />
      </div>
    </div>
  );
}
