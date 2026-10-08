"use client";

import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import type { StoryCharacter } from "../types";

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

type CharacterBubbleProps = {
  character: StoryCharacter;
  className?: string;
};

/**
 * 店のAIキャラのひとこと。店主の書いた本文とは別に、キャラの吹き出しで出す。
 * AI の言葉だと分かるように、名前の横に必ず「AI」の印を付ける。
 */
export function StoryCharacterBubble({ character, className }: CharacterBubbleProps) {
  return (
    <div className={cn("flex items-end gap-2", className)}>
      <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-full bg-white ring-2 ring-white/80">
        <Image
          src={character.imageUrl}
          alt=""
          fill
          sizes="44px"
          unoptimized
          className="object-cover"
        />
      </div>
      <div className="min-w-0 rounded-card rounded-bl-md bg-white px-3.5 py-2.5 text-left text-nicchyo-ink shadow-float">
        <p className="flex items-center gap-1.5 text-[11px] font-bold leading-tight text-nicchyo-ink/55">
          <span className="truncate">{character.name}</span>
          <span className="flex-shrink-0 rounded-chip bg-nicchyo-ink/10 px-1.5 py-px text-[10px] text-nicchyo-ink/70">
            AI
          </span>
        </p>
        <p className="mt-0.5 text-sm leading-relaxed">{character.line}</p>
      </div>
    </div>
  );
}

/** デモの投稿であることを示す印。架空の店を本物と取り違えないように、名札の横に置く */
export function StoryDemoBadge() {
  return (
    <span className="flex-shrink-0 rounded-chip bg-nicchyo-accent px-2 py-0.5 text-[10px] font-bold text-nicchyo-ink">
      デモ
    </span>
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
