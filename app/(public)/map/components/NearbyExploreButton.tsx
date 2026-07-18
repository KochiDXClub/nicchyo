'use client';

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
    <div
      className={`absolute left-1/2 z-[1150] -translate-x-1/2 transition-all duration-500 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2'
      }`}
      style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      aria-hidden={!visible}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        tabIndex={visible ? 0 : -1}
        className="flex items-center gap-2 rounded-full border border-amber-200 bg-white/95 px-4 py-2.5 shadow-lg backdrop-blur-sm transition-transform active:scale-95"
      >
        <span aria-hidden className="text-base leading-none">👀</span>
        <span className="text-center text-[13px] font-bold leading-snug text-amber-900">
          このへん、
          <br />
          なにがある？
        </span>
      </button>
    </div>
  );
}
