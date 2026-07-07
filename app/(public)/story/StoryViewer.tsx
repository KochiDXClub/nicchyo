"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { StoryItem } from "./types";

const STORY_DURATION = 15000;
// スワイプ判定のしきい値（移動量で方向を決め、曖昧な場合のみ速度で補助判定）
const SWIPE_DISTANCE = 60; // px
const SWIPE_VELOCITY = 300; // px/s

type Props = {
  stories: StoryItem[];
  initialIndex: number;
  onClose: () => void;
};

export default function StoryViewer({ stories, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);

  const story = stories[index];
  const shopName = story.vendor?.shop_name ?? "出店者";
  const avatarUrl = story.vendor?.shop_image_url ?? null;

  // スクロールロック
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const goNext = useCallback(() => {
    if (index < stories.length - 1) {
      setDirection(1);
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [index, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setDirection(-1);
      setIndex((i) => i - 1);
    }
  }, [index]);

  // 現在の投稿での経過時間を保持し、ホールド解除後は残り時間でタイマーを再設定する
  // （CSSプログレスバーは一時停止位置から再開するため、両者を同期させる）
  const elapsedRef = useRef(0);
  const segmentStartRef = useRef(0);

  // 投稿が切り替わったら経過時間をリセット
  useEffect(() => {
    elapsedRef.current = 0;
  }, [index]);

  // 15秒自動送り（ホールド中は停止し、解除時は残り時間で再開）
  useEffect(() => {
    if (paused) return;
    segmentStartRef.current = Date.now();
    const remaining = Math.max(0, STORY_DURATION - elapsedRef.current);
    const timer = setTimeout(goNext, remaining);
    return () => {
      clearTimeout(timer);
      elapsedRef.current += Date.now() - segmentStartRef.current;
    };
  }, [index, paused, goNext]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const { x } = info.offset;
    const { x: vx } = info.velocity;
    // まず移動量で方向を決定し、移動量が小さい（曖昧な）場合のみ速度で判定する
    if (x < -SWIPE_DISTANCE) goNext();
    else if (x > SWIPE_DISTANCE) goPrev();
    else if (vx < -SWIPE_VELOCITY) goNext();
    else if (vx > SWIPE_VELOCITY) goPrev();
  };

  const postedDate = new Date(story.created_at);
  const timeLabel = formatRelativeTime(postedDate);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[10000] bg-black flex flex-col touch-none"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      {/* 上部：ショップ情報 + 閉じる */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-10 pb-4 bg-gradient-to-b from-black/60 to-transparent">
        {/* プログレスバー */}
        <div className="flex gap-1 mb-3">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/30">
              {i < index ? (
                <div className="h-full w-full bg-white rounded-full" />
              ) : i === index ? (
                <div
                  className="h-full bg-white rounded-full"
                  style={{
                    animation: `story-progress ${STORY_DURATION}ms linear forwards`,
                    animationPlayState: paused ? "paused" : "running",
                  }}
                />
              ) : (
                <div className="h-full w-0" />
              )}
            </div>
          ))}
        </div>

        {/* ショップ情報行 */}
        <div className="flex items-center gap-2.5">
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
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            aria-label="閉じる"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* 画像（スワイプ領域） */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={story.id}
          custom={direction}
          variants={{
            enter: (d: number) => ({ x: d > 0 ? "100%" : "-100%", opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit: (d: number) => ({ x: d > 0 ? "-30%" : "30%", opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 320, damping: 36 }}
          drag="x"
          dragElastic={0.15}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
        >
          <Image
            src={story.image_url}
            alt={story.body ?? shopName}
            fill
            className="object-contain select-none"
            draggable={false}
            priority
          />
        </motion.div>
      </AnimatePresence>

      {/* 下部：キャプション */}
      {story.body && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pt-16 pb-10 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-white text-sm leading-relaxed">{story.body}</p>
        </div>
      )}

      {/* ホールド中インジケーター */}
      {paused && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          </div>
        </div>
      )}

      {/* スワイプガイド（最初の投稿のみ） */}
      {index === 0 && stories.length > 1 && (
        <div className="absolute bottom-8 right-4 z-10 pointer-events-none">
          <motion.div
            animate={{ x: [0, -8, 0] }}
            transition={{ repeat: 2, duration: 0.8, ease: "easeInOut" }}
            className="flex items-center gap-1 text-white/50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <span className="text-[10px]">左にスワイプで次へ</span>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  return `${d}日前`;
}
