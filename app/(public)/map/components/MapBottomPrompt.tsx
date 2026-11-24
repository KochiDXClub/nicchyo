'use client';

/**
 * MapBottomPrompt
 *
 * 地図の下中央（ナビの少し上）にふわっと浮かぶ、1 行の丸いボタンの置き場所。
 * 「このへん、なにがある？」と「日曜市にもどる」が同じ場所・同じ出方を使う。
 * 地図へのタップ・ドラッグとして伝わらないよう、押下はここで止める。
 */

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** 下中央のボタンの共通の形（高さ 44px の丸いボタン、1 行） */
export const MAP_BOTTOM_PROMPT_BUTTON_CLASS =
  'flex h-11 items-center gap-2 whitespace-nowrap rounded-chip text-[14px] font-bold transition-transform active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400';

export default function MapBottomPrompt({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'absolute left-1/2 z-[1150] -translate-x-1/2 transition-[opacity,transform] duration-500 ease-out-soft motion-reduce:transition-opacity',
        visible ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0'
      )}
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );
}
