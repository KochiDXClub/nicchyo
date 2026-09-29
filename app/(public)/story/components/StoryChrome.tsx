"use client";

import Image from "next/image";

/**
 * ストーリーの上端に重ねる部品（経過バーと店の名札）。
 * 全画面ビューア（StoryViewer）と、一覧の上に出す半開きのカード（StoryCover）で
 * 同じ見た目にするため、ここに置いて両方から使う。
 */

type ProgressBarsProps = {
  count: number;
  index: number;
  /** 表示中の投稿のバーを伸ばす時間。省略すると伸ばさない（再生前の見た目） */
  durationMs?: number;
  paused?: boolean;
};

export function StoryProgressBars({ count, index, durationMs, paused = false }: ProgressBarsProps) {
  return (
    <div className="flex gap-1 mb-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/30">
          {i < index ? (
            <div className="h-full w-full bg-white rounded-full" />
          ) : i === index && durationMs ? (
            <div
              className="h-full bg-white rounded-full"
              style={{
                animation: `story-progress ${durationMs}ms linear forwards`,
                animationPlayState: paused ? "paused" : "running",
              }}
            />
          ) : (
            <div className="h-full w-0" />
          )}
        </div>
      ))}
    </div>
  );
}

type ShopInfoProps = {
  shopName: string;
  avatarUrl: string | null;
  timeLabel: string;
};

export function StoryShopInfo({ shopName, avatarUrl, timeLabel }: ShopInfoProps) {
  return (
    <>
      <div className="w-8 h-8 rounded-full overflow-hidden bg-nicchyo-soft-green ring-2 ring-nicchyo-primary flex-shrink-0 flex items-center justify-center">
        {avatarUrl ? (
          <Image src={avatarUrl} alt={shopName} width={32} height={32} className="object-cover w-full h-full" />
        ) : (
          <span className="text-xs font-bold text-nicchyo-ink">{shopName.charAt(0)}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight truncate">{shopName}</p>
        <p className="text-white/60 text-[11px] leading-tight">{timeLabel}</p>
      </div>
    </>
  );
}

export function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}
