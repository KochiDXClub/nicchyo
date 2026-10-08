'use client';

/**
 * OdekakeLaunchButton
 *
 * マップ上から「おでかけサポート」を開くボタン。/facilities へ移動しなくても、
 * その場でお手洗い・休けい・のりものの案内を始められる。
 * 現在地ボタンと同じ高さの左側に置き、同じ大きさ・同じ影で対にする。
 */

import { Navigation } from 'lucide-react';

export default function OdekakeLaunchButton({ top, onClick }: { top: number; onClick: () => void }) {
  return (
    <div
      className="absolute left-3 z-[1001]"
      style={{ top }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        aria-label="おでかけサポートを開く"
        className="flex items-center gap-2 rounded-full bg-nicchyo-accent py-2.5 pl-3 pr-4 text-nicchyo-ink shadow-[0_6px_18px_rgba(58,58,58,0.22)] transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
      >
        <Navigation size={16} aria-hidden />
        <span className="text-[13px] font-black leading-none">おでかけ</span>
      </button>
    </div>
  );
}
