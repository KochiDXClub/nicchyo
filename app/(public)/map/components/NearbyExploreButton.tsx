'use client';

import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import MapBottomPrompt, { MAP_BOTTOM_PROMPT_BUTTON_CLASS } from './MapBottomPrompt';

/**
 * NearbyExploreButton
 *
 * マップ操作が静止したときにボヤっとフェード表示される
 * 「このへん、なにがある？」ボタン。表示条件は
 * useNearbyPromptVisibility が管理し、ここは見た目のみ担当する。
 */

export default function NearbyExploreButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <MapBottomPrompt visible={visible}>
      {/* 1 行に収めた丸いボタン。2 行に折ると地図の上で吹き出しのように見え、押せるものに見えにくい */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        tabIndex={visible ? 0 : -1}
        className={cn(MAP_BOTTOM_PROMPT_BUTTON_CLASS, 'bg-white pl-1.5 pr-4 text-nicchyo-ink shadow-pop ring-1 ring-amber-200')}
      >
        <span aria-hidden className="flex h-8 w-8 items-center justify-center rounded-chip bg-amber-500 text-white">
          <Sparkles className="h-4 w-4" strokeWidth={2.2} />
        </span>
        このへん、なにがある？
      </button>
    </MapBottomPrompt>
  );
}
