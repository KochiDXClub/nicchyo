"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";
import { computeIntroTransform, toTransformStyle } from "@/lib/grandma/introTransform";

/** 現れるまで。いきなり大写しの顔が出ると驚かせるので、薄くから出す */
const ENTER_MS = 300;
/** 大きいまま見せる間。ここで「誰に相談する画面か」が伝わる */
const HOLD_MS = 800;
/** 定位置まで縮む間。急ぐと「消えた」ように見えるので、ゆっくり寄せる */
const SHRINK_MS = 1000;
/** 縮み終わってから消えるまで */
const FADE_MS = 220;

/** 勢いよく縮んで、定位置でそっと止まる曲線 */
const EASING = "cubic-bezier(0.22, 0.61, 0.36, 1)";

export interface ConsultIntroProps {
  /** 縮んだ先。ページ内のにちよさん（hero）を囲む要素 */
  targetRef: RefObject<HTMLElement | null>;
  /**
   * にちよさんが定位置に着いた合図。
   * 演出をしなかったとき（動きを減らす設定・測れなかったとき）もすぐに呼ぶので、
   * 受け取る側はこれを「本文を出してよい合図」としてそのまま使える。
   */
  onSettled?: () => void;
}

/**
 * 相談ページの入り。
 *
 * にちよさんを画面いっぱいに出してから、ページ内の定位置まで縮める。
 * マップ・検索と違い、この画面は「誰かに相談する」ことが分からないと使えないので、
 * 待っている間に読ませる文章は置かず、相手そのものだけを見せる。
 *
 * 動かすのは transform と opacity だけにしてある。height / width を動かすと
 * 毎フレーム レイアウトが走り、下の候補ボタンまで一緒に動いてしまう。
 *
 * 動きを減らす設定のときは何も出さない（相談は待たされる画面ではないので、
 * 演出を省いても失われる情報がない）。
 */
export default function ConsultIntro({ targetRef, onSettled }: ConsultIntroProps) {
  const heroRef = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState(false);
  const [transform, setTransform] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [finished, setFinished] = useState(false);

  // 呼び出し側が毎回新しい関数を渡しても、演出がやり直しにならないようにする
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setFinished(true);
      onSettledRef.current?.();
      return;
    }

    const timers: ReturnType<typeof setTimeout>[] = [];

    // 出すのは次のフレーム。同じフレームで濃くすると transition が乗らず、
    // 結局いきなり現れてしまう。
    // 裏のタブでは次のフレームが来ないので、時間でも出るようにしておく
    // （出さないままだと、戻ってきたときに絵が消えたように見える）
    const raf = requestAnimationFrame(() => setEntered(true));
    timers.push(setTimeout(() => setEntered(true), 80));

    timers.push(
      setTimeout(() => {
        const from = heroRef.current?.getBoundingClientRect();
        const to = targetRef.current?.getBoundingClientRect();
        // 測れないとき・大きい絵が定位置より十分大きく出ていないときは、
        // 演出を諦めてそのままページを見せる（見当違いの場所へ飛ぶより良い）
        if (!from || !to || to.width === 0 || from.width < to.width * 1.5) {
          setFinished(true);
          onSettledRef.current?.();
          return;
        }

        setTransform(toTransformStyle(computeIntroTransform(from, to)));
        // 着いた時点で知らせる。本文はここから薄れて出てくるので、
        // 消えていくオーバーレイと重なって「じわっと現れた」ように見える
        timers.push(
          setTimeout(() => {
            setLeaving(true);
            onSettledRef.current?.();
          }, SHRINK_MS)
        );
        timers.push(setTimeout(() => setFinished(true), SHRINK_MS + FADE_MS));
        // 薄く現れきってから、大きいまま見せる時間を数える
      }, ENTER_MS + HOLD_MS)
    );

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
    };
  }, [targetRef]);

  if (finished) return null;

  return (
    <div
      // 下のナビゲーションバー（z-[9997]）より下に置く。
      // 入りの2秒ほど行き先を選べなくなるのは、待たせ方として重い
      className={`consult-intro fixed inset-0 z-[9990] overflow-hidden transition-opacity duration-200 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div
        ref={heroRef}
        // 絵の四角には透けた余白が広くあり、にちよさん自身は縦69%・横43%しかない。
        // 大きく見せるには、四角のほうを画面より大きく取る必要がある
        // （縦は 56vh ぶんの四角＝にちよさんが画面の高さの4割ほど、横は 132vw で頭打ち）
        className="absolute left-1/2 top-[44%] h-[min(132vw,56vh)] w-[min(132vw,56vh)]"
        style={{
          // 中央寄せの分は常に効かせたままにしないと、縮む先が半分ずれる
          transform: `translate(-50%, -50%)${transform ? ` ${transform}` : ""}`,
          transition: transform ? `transform ${SHRINK_MS}ms ${EASING}` : undefined,
        }}
      >
        <div
          className="h-full w-full"
          style={{ opacity: entered ? 1 : 0, transition: `opacity ${ENTER_MS}ms ease-out` }}
        >
          <Image
            src="/characters/obaasan.png"
            alt=""
            width={480}
            height={480}
            priority
            className="h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(146,64,14,0.25)]"
          />
        </div>
      </div>
    </div>
  );
}
