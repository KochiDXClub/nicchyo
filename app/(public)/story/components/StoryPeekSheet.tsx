"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronUp, X } from "lucide-react";
import { vibrate } from "@/lib/ui/haptics";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";
import type { StoryItem } from "../types";
import StoryCover from "./StoryCover";

/** 半開きのときの高さ（画面に対する割合）。上に出店者の列と一覧の頭が見えている */
const PEEK_RATIO = 0.6;
/** これだけ上へ引いて離したら再生を始める（px） */
const LAUNCH_DISTANCE = 72;
/** これだけ下へ引いて離したら閉じる（px、抵抗をかける前の指の量） */
const DISMISS_DISTANCE = 96;
/** これより速く払ったら、距離に関係なく払った向きへ（px/s） */
const FLICK_VELOCITY = 450;
/** 下へ引くときの抵抗。1 で指と同じ */
const DOWN_RESISTANCE = 0.6;
/** ホイール・トラックパッドで開閉する量 */
const WHEEL_THRESHOLD = 12;
/** 半開きへ戻る動き */
const SETTLE_SPRING = { type: "spring", stiffness: 420, damping: 38, mass: 0.9 } as const;
/** 全画面へ広がる・下へ閉じる動き。終わったら次へ渡すので、時間の決まる tween にする */
const EXIT_TWEEN = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;
/** ナビゲーションバーの上に載せる */
const NAV_SPACE = "calc(var(--nav-bar-height) + var(--safe-bottom, 0px))";
const DESKTOP_QUERY = "(min-width: 768px)";

type Props = {
  story: StoryItem;
  /** 全投稿の数（経過バーの本数） */
  count: number;
  /** 上へ引き切った・タップしたとき。全画面のストーリーを先頭から始める */
  onLaunch: () => void;
  /** 下へ払った・閉じるを押したとき */
  onDismiss: () => void;
};

/**
 * 近況ページを開いたときに下から半分だけ出る、最新の投稿のストーリー（スマホのみ）。
 *
 * マップの「はじめての方へ」と同じく、ページの上に重ねたシートで、指に 1:1 で付いてくる。
 *   上へ引く … シートが伸び、そのまま全画面のストーリー再生に切り替わる
 *   下へ引く … 抵抗を受けながら下がり、離すと閉じて一覧が触れるようになる
 *   タップ   … 上へ引いたのと同じ
 * 全画面に着いた時点でシートと全画面ビューア（StoryViewer）の見た目が揃っているので、
 * 引き上げた指からそのまま再生が始まったように見える。
 */
export default function StoryPeekSheet({ story, count, onLaunch, onDismiss }: Props) {
  const reduceMotion = useReducedMotion() ?? false;
  const sheetRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef(typeof window === "undefined" ? 0 : Math.round(window.innerHeight * PEEK_RATIO));
  /** 引き始めたときの全画面の高さ（ナビゲーションバーの上端まで） */
  const fullRef = useRef(0);
  const pannedRef = useRef(false);
  /** 再生を始めた・閉じたあとは指に反応しない */
  const doneRef = useRef(false);

  /** シートの高さ。半開きから全画面まで指なりに伸びる */
  const height = useMotionValue(peekRef.current);
  /** 半開きより下へ引いた量。最初は画面の外から出てくる */
  const y = useMotionValue(reduceMotion ? 0 : peekRef.current);

  const onLaunchRef = useRef(onLaunch);
  onLaunchRef.current = onLaunch;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // 下から出てくる
  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(y, 0, SETTLE_SPRING);
    return () => controls.stop();
  }, [reduceMotion, y]);

  // シートが出ているあいだは後ろの一覧をスクロールさせない（指の上下はシートのもの）
  useBodyScrollLock();

  // 画面の高さが変わったら（アドレスバーの出入り・回転）半開きの高さを合わせ直す。
  // PC の幅になったらシートは出さない（一覧の横に表紙が出る）
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onResize = () => {
      if (query.matches) {
        onDismissRef.current();
        return;
      }
      peekRef.current = Math.round(window.innerHeight * PEEK_RATIO);
      if (!doneRef.current) height.set(peekRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [height]);

  const fullHeight = useCallback(
    () => sheetRef.current?.getBoundingClientRect().bottom ?? window.innerHeight,
    []
  );

  const launch = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    vibrate(8);
    if (reduceMotion) {
      onLaunchRef.current();
      return;
    }
    animate(y, 0, EXIT_TWEEN);
    animate(height, fullHeight(), { ...EXIT_TWEEN, onComplete: () => onLaunchRef.current() });
  }, [fullHeight, height, reduceMotion, y]);

  const dismiss = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    if (reduceMotion) {
      onDismissRef.current();
      return;
    }
    animate(y, height.get() + 24, { ...EXIT_TWEEN, onComplete: () => onDismissRef.current() });
  }, [height, reduceMotion, y]);

  const settleBack = useCallback(() => {
    animate(height, peekRef.current, SETTLE_SPRING);
    animate(y, 0, SETTLE_SPRING);
  }, [height, y]);

  const handlePanStart = () => {
    pannedRef.current = true;
    fullRef.current = fullHeight();
  };

  const handlePan = (_: unknown, info: PanInfo) => {
    if (doneRef.current) return;
    const dy = info.offset.y;
    if (dy < 0) {
      height.set(Math.min(fullRef.current, peekRef.current - dy));
      y.set(0);
    } else {
      height.set(peekRef.current);
      y.set(dy * DOWN_RESISTANCE);
    }
  };

  const handlePanEnd = (_: unknown, info: PanInfo) => {
    if (doneRef.current) return;
    const dy = info.offset.y;
    const vy = info.velocity.y;
    if (dy < -LAUNCH_DISTANCE || vy < -FLICK_VELOCITY) launch();
    else if (dy > DISMISS_DISTANCE || vy > FLICK_VELOCITY) dismiss();
    else settleBack();
  };

  const handleClick = () => {
    // 引いて離したときにも click が来るので、そのときは何もしない
    if (pannedRef.current) return;
    launch();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      launch();
    } else if (e.key === "Escape") {
      dismiss();
    }
  };

  const handleClose = (e: MouseEvent) => {
    e.stopPropagation();
    dismiss();
  };

  const shopName = story.vendor?.shop_name ?? "出店者";

  return (
    <motion.div
      ref={sheetRef}
      role="button"
      tabIndex={0}
      aria-label={`${shopName}の近況を再生`}
      data-testid="story-peek-sheet"
      className="fixed inset-x-0 z-[9990] outline-none md:hidden"
      style={{ bottom: NAV_SPACE, height, y, touchAction: "none" }}
      onPointerDown={() => {
        pannedRef.current = false;
      }}
      onPanStart={handlePanStart}
      onPan={handlePan}
      onPanEnd={handlePanEnd}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onWheel={(e) => {
        if (e.deltaY > WHEEL_THRESHOLD) launch();
        else if (e.deltaY < -WHEEL_THRESHOLD) dismiss();
      }}
    >
      <div className="relative h-full overflow-hidden rounded-t-sheet shadow-float">
        {/* つまみ。引ける面であることを示す */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1.5 z-20 h-1 w-10 -translate-x-1/2 rounded-chip bg-white/60"
        />
        <StoryCover
          story={story}
          count={count}
          priority
          headerAction={
            <button
              type="button"
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
              aria-label="閉じる"
            >
              <X className="h-4 w-4 text-white" strokeWidth={2.5} aria-hidden />
            </button>
          }
          footer={
            <div className="mt-3 flex flex-col items-center text-white/80" aria-hidden>
              <motion.span
                animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              >
                <ChevronUp className="h-5 w-5" strokeWidth={2.2} />
              </motion.span>
              <span className="text-[11px] font-semibold">上にスワイプで再生</span>
            </div>
          }
        />
      </div>
    </motion.div>
  );
}
