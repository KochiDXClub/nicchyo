"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  formatRelativeTime,
  StoryCharacterBubble,
  StoryDemoBadge,
  StoryProgressBars,
  StoryShopInfo,
} from "./components/StoryChrome";
import { getOrCreateConsultVisitorKey } from "@/lib/consultVisitorKey";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";
import { ChevronUp } from "lucide-react";
import StoryDetailSheet from "./components/StoryDetailSheet";
import { fetchReactionState, toggleReaction, type ReactionState } from "@/lib/story/reactions";
import type { StoryItem } from "./types";

const STORY_DURATION = 15000;
// スワイプ判定のしきい値（移動量で方向を決め、曖昧な場合のみ速度で補助判定）
const SWIPE_DISTANCE = 60; // px
const SWIPE_VELOCITY = 300; // px/s
// タップ/長押し判定のしきい値（Instagramのストーリー操作に合わせる）
const LONG_PRESS_MS = 220;
const TAP_MOVE_TOLERANCE = 10; // px（これを超えたらスワイプ扱いにしてタップ送りを無効化）
// 縦のスワイプ：上へ払うと「詳しく」を開き、下へ払うとビューアを閉じる
const SWIPE_UP_DISTANCE = 60; // px
const SWIPE_DOWN_DISTANCE = 90; // px

type Props = {
  stories: StoryItem[];
  initialIndex: number;
  onClose: () => void;
  /**
   * デモ（/demo/story）として開くとき。ハートはサーバーに送らず、この画面の中だけで数える。
   * heartCounts は投稿ごとの見本のハート数
   */
  demo?: { heartCounts: Record<string, number> };
};

export default function StoryViewer({ stories, initialIndex, onClose, demo }: Props) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  // 「詳しく」（店主の説明とマップへの導線）を開いているか。開いているあいだは自動送りを止める
  const [detailOpen, setDetailOpen] = useState(false);
  const stopped = paused || detailOpen;
  // 匿名ハート用の visitorKey（相談機能と共通の識別子を流用）
  const [visitorKey] = useState(() =>
    typeof window !== "undefined" ? getOrCreateConsultVisitorKey() : ""
  );
  const [reaction, setReaction] = useState<ReactionState | null>(null);

  const story = stories[index];
  const shopName = story.vendor?.shop_name ?? "出店者";
  const avatarUrl = story.vendor?.shop_image_url ?? null;
  // 「詳しく」に出すものがあるか（店主の説明か、マップの店への導線）
  const hasDetail = Boolean(story.body) || story.vendor?.store_number != null;

  // スクロールロック
  useBodyScrollLock();

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

  // 投稿が切り替わったら経過時間をリセットし、「詳しく」も閉じる
  useEffect(() => {
    elapsedRef.current = 0;
    setDetailOpen(false);
  }, [index]);

  // 15秒自動送り（ホールド中は停止し、解除時は残り時間で再開）
  useEffect(() => {
    if (stopped) return;
    segmentStartRef.current = Date.now();
    const remaining = Math.max(0, STORY_DURATION - elapsedRef.current);
    const timer = setTimeout(goNext, remaining);
    return () => {
      clearTimeout(timer);
      elapsedRef.current += Date.now() - segmentStartRef.current;
    };
  }, [index, stopped, goNext]);

  // 表示中ストーリーのハート状態（総数・自分が押したか）を取得する。
  // デモの投稿はサーバーに無いので、見本の数から始める。
  // 見本の数は ref から読み、effect は「デモかどうか」と投稿が変わったときだけ走らせる。
  // demo オブジェクトそのものに依存すると、親が描き直すたびに押したハートが見本の数に戻る
  const isDemo = demo !== undefined;
  const demoHeartCountsRef = useRef(demo?.heartCounts);
  demoHeartCountsRef.current = demo?.heartCounts;
  useEffect(() => {
    if (isDemo) {
      setReaction({ count: demoHeartCountsRef.current?.[story.id] ?? 0, reacted: false });
      return;
    }
    if (!visitorKey) return;
    let cancelled = false;
    setReaction(null);
    fetchReactionState(story.id, visitorKey)
      .then((state) => { if (!cancelled) setReaction(state); })
      .catch(() => { if (!cancelled) setReaction({ count: 0, reacted: false }); });
    return () => { cancelled = true; };
  }, [isDemo, story.id, visitorKey]);

  // ハートのトグル（楽観更新→失敗時は元に戻す）
  const handleToggleReaction = useCallback(async () => {
    if (!reaction || (!isDemo && !visitorKey)) return;
    const previous = reaction;
    setReaction({
      reacted: !previous.reacted,
      count: previous.count + (previous.reacted ? -1 : 1),
    });
    // デモはこの画面の中だけで数える（visitorKey の判定は型の絞り込みのため）
    if (isDemo || !visitorKey) return;
    try {
      setReaction(await toggleReaction(story.id, visitorKey));
    } catch {
      setReaction(previous);
    }
  }, [isDemo, reaction, story.id, visitorKey]);

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
      if (!press || press.longPress) return;
      if (press.moved) {
        // 縦に大きく払ったときだけ扱う（横のスワイプは handleDragEnd が受け持つ）
        const dx = e.clientX - press.x;
        const dy = e.clientY - press.y;
        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy < -SWIPE_UP_DISTANCE && hasDetail) setDetailOpen(true);
          else if (dy > SWIPE_DOWN_DISTANCE) onClose();
        }
        return;
      }
      const rect = e.currentTarget.getBoundingClientRect();
      const tappedRight = press.x - rect.left > rect.width / 2;
      if (tappedRight) goNext();
      else goPrev();
    },
    [clearLongPressTimer, goNext, goPrev, hasDetail, onClose]
  );

  const handlePressCancel = useCallback(() => {
    clearLongPressTimer();
    pressStateRef.current = null;
    setPaused(false);
  }, [clearLongPressTimer]);

  // PC ではキーボードでも送れるようにする（← → で前後、Esc で閉じる）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // 「詳しく」を開いているあいだは、Esc でそれだけを閉じ、送りもしない
      if (detailOpen) {
        if (e.key === "Escape") setDetailOpen(false);
        return;
      }
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailOpen, goNext, goPrev, onClose]);

  const timeLabel = formatRelativeTime(new Date(story.created_at));

  // マップ上のショップバナー（/map?shop=<店舗番号>）へのリンク用。
  // 割当が無い出店者はリンク無効。
  const storeNumber = story.vendor?.store_number ?? null;

  const shopInfo = <StoryShopInfo shopName={shopName} avatarUrl={avatarUrl} timeLabel={timeLabel} />;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-[10000] bg-black flex flex-col touch-none"
      // PC で縦長の枠の外（左右の黒い余白）をクリックしたら閉じる。スマホでは枠が画面いっぱいなので起きない
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* PC では画面いっぱいに横長で広げず、スマホと同じ縦長の枠に収めて中央に置く。
          タップ送り・長押しの判定はこの枠の中だけで取り、切り替えの横スライドも枠の外へはみ出させない */}
      <div
        className="relative mx-auto h-full w-full overflow-hidden md:max-w-[calc(100dvh*9/16)]"
        onPointerDown={handlePressStart}
        onPointerMove={handlePressMove}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressCancel}
        onPointerCancel={handlePressCancel}
      >
      {/* 上部：ショップ情報 + 閉じる */}
      <div className="absolute top-0 left-0 right-0 z-10 px-4 pt-10 pb-4 bg-gradient-to-b from-black/60 to-transparent">
        {/* プログレスバー */}
        <StoryProgressBars
          count={stories.length}
          index={index}
          durationMs={STORY_DURATION}
          paused={stopped}
        />

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
          {demo && <StoryDemoBadge />}
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

      {/* 下部：店のAIキャラのひとこと（主役）と、「詳しく」への入口。
          店主の説明は二番目の情報なので、ここでは1行だけのぞかせ、全文は「詳しく」で読む */}
      {(story.character || hasDetail) && (
        <div className="absolute bottom-0 left-0 right-0 z-10 px-4 pt-16 pb-10 bg-gradient-to-t from-black/70 to-transparent">
          {/* ハートのボタンと重ならないよう右を空ける */}
          {story.character && (
            <StoryCharacterBubble character={story.character} className="mb-3 pr-16" />
          )}
          {hasDetail && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={() => setDetailOpen(true)}
              aria-expanded={detailOpen}
              className="flex w-full items-center gap-2 pr-16 text-left"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] text-white/75">
                {story.body ?? "お店の場所を見る"}
              </span>
              <span className="flex flex-shrink-0 items-center gap-0.5 text-xs font-semibold text-white">
                詳しく
                <ChevronUp className="h-4 w-4" aria-hidden />
              </span>
            </button>
          )}
        </div>
      )}

      <StoryDetailSheet open={detailOpen} story={story} onClose={() => setDetailOpen(false)} />

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
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2 whitespace-nowrap rounded-chip bg-black/55 px-3 py-1.5 text-white/85"
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
      </div>
    </motion.div>
  );
}

