"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { computeWalkInStartX, computeWalkOutEndX } from "@/lib/grandma/introWalk";
import GrandmaAvatar from "./GrandmaAvatar";
import type { ConsultCharacter } from "../data/consultCharacters";

/** 前の人が去るまで */
const OUT_MS = 700;
/** 次の人が歩き出すまで（前の人と少し重ねると、入れ替わりが1つの動きに見える） */
const IN_DELAY_MS = 200;
/** 次の人が定位置に着くまで */
const IN_MS = 900;
/** 去るときは加速して、来るときは定位置ですっと止まる */
const OUT_EASING = "cubic-bezier(0.4, 0, 0.9, 0.6)";
const IN_EASING = "cubic-bezier(0.12, 0.4, 0.28, 1)";

export interface ConsultCharacterSwapProps {
  /** 入れ替わる前の話し手。右へ歩いて去る */
  from: ConsultCharacter;
  /** 新しい話し手。左から歩いてきて定位置で止まる */
  to: ConsultCharacter;
  /** 立ち位置。ページ内の話し手（hero）を囲む要素 */
  targetRef: RefObject<HTMLElement | null>;
  /** 入れ替わりが終わった合図。呼ばれたらページ側の絵に戻してよい */
  onDone: () => void;
}

type Spot = { left: number; top: number; width: number; height: number; outX: number; inX: number };

/**
 * 話し手の入れ替わり。
 *
 * 前の人が定位置から右の画面外へ歩いて去り、入れ替わりに新しい人が左から歩いてくる。
 * 絵を差し替えるだけだと「今だれと話しているのか」が変わったことに気づけないが、
 * 出て行って入ってくるなら、見ているだけで分かる。
 *
 * ページの上に重ねるだけの層なので、地の色は敷かない（後ろの本文はそのまま見える）。
 * ページ側の絵は入れ替わりのあいだ隠しておき、着いたところで戻す。
 *
 * 動きを減らす設定のときは歩かせず、すぐに入れ替える。
 */
export default function ConsultCharacterSwap({
  from,
  to,
  targetRef,
  onDone,
}: ConsultCharacterSwapProps) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [moving, setMoving] = useState(false);

  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      onDoneRef.current();
      return;
    }

    const rect = targetRef.current?.getBoundingClientRect();
    // 立ち位置が測れないときは歩かせず、そのまま入れ替える
    if (!rect || rect.width === 0) {
      onDoneRef.current();
      return;
    }

    setSpot({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      outX: computeWalkOutEndX(rect, window.innerWidth),
      inX: computeWalkInStartX(rect),
    });

    // 動かし始めるのは、立ち位置が一度描かれたあと。
    // 同じフレームで終点を決めると transform が乗らず、瞬間移動になる
    let secondRaf = 0;
    const raf = requestAnimationFrame(() => {
      secondRaf = requestAnimationFrame(() => setMoving(true));
    });
    // 裏のタブでは次のフレームが来ないので、時間でも動き出すようにしておく
    const kick = setTimeout(() => setMoving(true), 120);
    const done = setTimeout(() => onDoneRef.current(), IN_DELAY_MS + IN_MS);

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(secondRaf);
      clearTimeout(kick);
      clearTimeout(done);
    };
  }, [targetRef]);

  if (!spot) return null;

  const frame = {
    position: "absolute" as const,
    left: `${spot.left}px`,
    top: `${spot.top}px`,
    width: `${spot.width}px`,
    height: `${spot.height}px`,
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[9990] overflow-hidden" aria-hidden="true">
      {/* 去る人 */}
      <div
        style={{
          ...frame,
          transform: moving ? `translateX(${spot.outX}px)` : "translateX(0)",
          transition: moving ? `transform ${OUT_MS}ms ${OUT_EASING}` : undefined,
        }}
      >
        <div className="consult-walk__step h-full w-full">
          <GrandmaAvatar pose="idle" size="hero" character={from} />
        </div>
      </div>

      {/* 来る人 */}
      <div
        style={{
          ...frame,
          transform: moving ? "translateX(0)" : `translateX(${spot.inX}px)`,
          transition: moving ? `transform ${IN_MS}ms ${IN_EASING} ${IN_DELAY_MS}ms` : undefined,
        }}
      >
        <div className="consult-walk__step h-full w-full" style={{ animationDelay: `${IN_DELAY_MS}ms` }}>
          <GrandmaAvatar pose="idle" size="hero" character={to} />
        </div>
      </div>
    </div>
  );
}
