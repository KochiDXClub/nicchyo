"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import type { StoryItem } from "./types";

type Props = {
  stories: StoryItem[];
  initialIndex: number;
  onClose: () => void;
};

export default function StoryViewer({ stories, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  const dragStartY = useRef(0);

  const story = stories[index];
  const shopName = story.vendor?.shop_name ?? "出店者";
  const avatarUrl = story.vendor?.shop_image_url ?? null;

  // スクロールロック
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const goNext = () => {
    if (index < stories.length - 1) {
      setDirection(1);
      setIndex((i) => i + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setDirection(-1);
      setIndex((i) => i - 1);
    }
  };

  const handleDragEnd = (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
    const { y } = info.offset;
    const { y: vy } = info.velocity;
    if (y < -60 || vy < -300) goNext();
    else if (y > 60 || vy > 300) goPrev();
  };

  const postedDate = new Date(story.posted_at);
  const timeLabel = formatRelativeTime(postedDate);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[10000] bg-black flex flex-col touch-none"
    >
      {/* 上部：ショップ情報 + 閉じる */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 px-4 pt-12 pb-4 bg-gradient-to-b from-black/60 to-transparent">
        {/* プログレスバー */}
        <div className="absolute top-6 left-4 right-4 flex gap-1">
          {stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] rounded-full overflow-hidden bg-white/30">
              <div
                className={`h-full rounded-full transition-all ${
                  i < index ? "bg-white w-full" : i === index ? "bg-white w-full" : "w-0"
                }`}
                style={i === index ? { width: "100%" } : undefined}
              />
            </div>
          ))}
        </div>

        {/* アバター */}
        <div className="w-9 h-9 rounded-full overflow-hidden bg-nicchyo-soft-green ring-2 ring-nicchyo-primary flex-shrink-0 flex items-center justify-center">
          {avatarUrl ? (
            <Image src={avatarUrl} alt={shopName} width={36} height={36} className="object-cover w-full h-full" />
          ) : (
            <span className="text-sm font-bold text-nicchyo-ink">{shopName.charAt(0)}</span>
          )}
        </div>

        {/* 名前 + 時刻 */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate">{shopName}</p>
          <p className="text-white/60 text-xs leading-tight">{timeLabel}</p>
        </div>

        {/* 閉じるボタン */}
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20"
          aria-label="閉じる"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 画像（スワイプ領域） */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={story.id}
          custom={direction}
          variants={{
            enter: (d: number) => ({ y: d > 0 ? "100%" : "-100%", opacity: 0 }),
            center: { y: 0, opacity: 1 },
            exit: (d: number) => ({ y: d > 0 ? "-30%" : "30%", opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ type: "spring", stiffness: 320, damping: 36 }}
          drag="y"
          dragElastic={0.15}
          dragConstraints={{ top: 0, bottom: 0 }}
          onDragStart={(_, info) => { dragStartY.current = info.point.y; }}
          onDragEnd={handleDragEnd}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
        >
          <Image
            src={story.image_url}
            alt={story.caption ?? shopName}
            fill
            className="object-contain select-none"
            draggable={false}
            priority
          />
        </motion.div>
      </AnimatePresence>

      {/* 下部：キャプション */}
      {story.caption && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pt-16 pb-12 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-white text-sm leading-relaxed">{story.caption}</p>
        </div>
      )}

      {/* スワイプガイド（初回のみ表示のため、index===0のみ） */}
      {index === 0 && stories.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: 2, duration: 0.8, ease: "easeInOut" }}
            className="flex flex-col items-center gap-1 text-white/50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
            </svg>
            <span className="text-[10px]">上にスワイプで次へ</span>
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
