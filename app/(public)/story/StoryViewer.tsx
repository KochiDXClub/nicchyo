"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { getStoryAgeBucket, STORY_AGE_IMAGE_CLASS } from "./age";
import { getOrCreateConsultVisitorKey } from "@/lib/consultVisitorKey";
import { fetchReactionState, toggleReaction, type ReactionState } from "@/lib/story/reactions";
import type { StoryItem } from "./types";

const STORY_DURATION = 15000;
// スワイプ判定のしきい値（移動量で方向を決め、曖昧な場合のみ速度で補助判定）
const SWIPE_DISTANCE = 60; // px
const SWIPE_VELOCITY = 300; // px/s
// タップ/長押し判定のしきい値（Instagramのストーリー操作に合わせる）
const LONG_PRESS_MS = 220;
const TAP_MOVE_TOLERANCE = 10; // px（これを超えたらスワイプ扱いにしてタップ送りを無効化）

type Props = {
  stories: StoryItem[];
  initialIndex: number;
  onClose: () => void;
};

export default function StoryViewer({ stories, initialIndex, onClose }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  // 匿名ハート用の visitorKey（相談機能と共通の識別子を流用）
  const [visitorKey] = useState(() =>
    typeof window !== "undefined" ? getOrCreateConsultVisitorKey() : ""
  );
  const [reaction, setReaction] = useState<ReactionState | null>(null);

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

  // 表示中ストーリーのハート状態（総数・自分が押したか）を取得する
  useEffect(() => {
    if (!visitorKey) return;
    let cancelled = false;
    setReaction(null);
    fetchReactionState(story.id, visitorKey)
      .then((state) => { if (!cancelled) setReaction(state); })
      .catch(() => { if (!cancelled) setReaction({ count: 0, reacted: false }); });
    return () => { cancelled = true; };
  }, [story.id, visitorKey]);

  // ハートのトグル（楽観更新→失敗時は元に戻す）
  const handleToggleReaction = useCallback(async () => {
    if (!visitorKey || !reaction) return;
    const previous = reaction;
    setReaction({
      reacted: !previous.reacted,
      count: previous.count + (previous.reacted ? -1 : 1),
    });
    try {
      setReaction(await toggleReaction(story.id, visitorKey));
    } catch {
      setReaction(previous);
    }
  }, [reaction, story.id, visitorKey]);

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    const { x } = info.offset;
    const { x: vx } = info.velocity;
    // まず移動量で方向を決定し、移動量が小さい（曖昧な）場合のみ速度で判定する
    if (x < -SWIPE_DISTANCE) goNext();
    else if (x > SWIPE_DISTANCE) goPrev();
    else if (vx < -SWIPE_VELOCITY) goNext();
    else if (vx > SWIPE_VELOCITY) goPrev();
  };

  // Instagramのストーリーに合わせたタップ操作：
  // 画面右半分タップ→次へ、左半分タップ→前へ、長押しのみ一時停止（離しても送らない）。
  // 横スワイプ（handleDragEnd）と共存させるため、一定以上動いたらタップ判定を無効化する。
  const pressStateRef = useRef<{ x: number; y: number; longPress: boolean; moved: boolean } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLongPressTimer(), [clearLongPressTimer]);

  const handlePressStart = useCallback(
    (e: ReactPointerEvent) => {
      pressStateRef.current = { x: e.clientX, y: e.clientY, longPress: false, moved: false };
      clearLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        if (pressStateRef.current) {
          pressStateRef.current.longPress = true;
          setPaused(true);
        }
      }, LONG_PRESS_MS);
    },
    [clearLongPressTimer]
  );

  const handlePressMove = useCallback((e: ReactPointerEvent) => {
    const press = pressStateRef.current;
    if (!press || press.moved) return;
    const dx = e.clientX - press.x;
    const dy = e.clientY - press.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_TOLERANCE) {
      press.moved = true;
      clearLongPressTimer();
    }
  }, [clearLongPressTimer]);

  const handlePressEnd = useCallback(
    (e: ReactPointerEvent) => {
      clearLongPressTimer();
      const press = pressStateRef.current;
      pressStateRef.current = null;
      setPaused(false);
      // スワイプ中だった／長押し中だった場合はタップ送りしない
      // （スワイプは handleDragEnd、長押しは離した時点で何もしないのが正解）
      if (!press || press.moved || press.longPress) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const tappedRight = press.x - rect.left > rect.width / 2;
      if (tappedRight) goNext();
      else goPrev();
    },
    [clearLongPressTimer, goNext, goPrev]
  );

  const handlePressCancel = useCallback(() => {
    clearLongPressTimer();
    pressStateRef.current = null;
    setPaused(false);
  }, [clearLongPressTimer]);

  const postedDate = new Date(story.created_at);
  const timeLabel = formatRelativeTime(postedDate);
  const ageBucket = getStoryAgeBucket(story.created_at);

  // マップ上のショップバナー（/map?shop=<店舗番号>）へのリンク用。
  // 割当が無い出店者はリンク無効。
  const storeNumber = story.vendor?.store_number ?? null;

  const shopInfo = (
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[10000] bg-black flex flex-col touch-none"
      onPointerDown={handlePressStart}
      onPointerMove={handlePressMove}
      onPointerUp={handlePressEnd}
      onPointerLeave={handlePressCancel}
      onPointerCancel={handlePressCancel}
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
          {storeNumber != null ? (
            <Link
              href={`/map?shop=${storeNumber}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center gap-2.5 flex-1 min-w-0 rounded-full transition active:opacity-80"
              aria-label={`${shopName}をマップで見る`}
            >
              {shopInfo}
            </Link>
          ) : (
            <div className="flex items-center gap-2.5 flex-1 min-w-0">{shopInfo}</div>
          )}
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
            className={`object-contain select-none ${STORY_AGE_IMAGE_CLASS[ageBucket]}`}
            draggable={false}
            priority
          />
        </motion.div>
      </AnimatePresence>

      {/* ハートリアクション（匿名・1投稿1ハート）。切替時のちらつきを防ぐため
          常時表示し、状態取得前はタップ不可にする。 */}
      <div className="absolute bottom-[136px] right-4 z-20 flex flex-col items-center gap-1">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggleReaction}
          disabled={!reaction}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-black/30 backdrop-blur transition active:scale-90 disabled:opacity-60"
          aria-label={reaction?.reacted ? "ハートを取り消す" : "ハートを送る"}
          aria-pressed={reaction?.reacted ?? false}
        >
          <svg
            className={`w-7 h-7 transition ${reaction?.reacted ? "text-rose-500" : "text-white"}`}
            fill={reaction?.reacted ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </button>
        {reaction && (
          <span className="text-white text-xs font-semibold drop-shadow tabular-nums">
            {reaction.count}
          </span>
        )}
      </div>

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

      {/* タップ操作ガイド（最初の投稿のみ） */}
      {index === 0 && stories.length > 1 && (
        <motion.div
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ delay: 2, duration: 0.6 }}
          className="absolute bottom-8 inset-x-0 z-10 pointer-events-none flex items-center justify-center gap-2 text-white/60"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          <span className="text-[10px]">画面の左右をタップで送る・長押しで一時停止</span>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </motion.div>
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
