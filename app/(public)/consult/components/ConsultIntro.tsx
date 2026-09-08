"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type RefObject } from "react";
import { computeWalkInStartX } from "@/lib/grandma/introWalk";

/** 画面の外から定位置まで歩いてくる時間 */
const WALK_MS = 1800;
/** 着いてから、こちらを向くまで */
const TURN_MS = 260;
/** 向き終わってから消えるまで */
const FADE_MS = 220;
/** 一歩の間隔。絵のコマ送りと、上下の揺れの周期に使う */
const STEP_MS = 420;

/** 歩き出しだけ軽く、止まるときはすっと止まる */
const EASING = "cubic-bezier(0.12, 0.4, 0.28, 1)";

/**
 * 歩いてくるところの絵（左から右へ歩く横顔）。
 *
 * 差し替え予定。並べた順にコマ送りするので、2枚以上あれば足が入れ替わって歩く。
 * 今は正面の絵しかないため1枚で、上下の揺れだけで歩いて見せている。
 *
 * 描き足すときの決まり：
 *   - 正面の絵（obaasan.png）と同じ 1024×1024 の透過 PNG
 *   - 足元の位置と背の高さを正面の絵とそろえる（着いた瞬間に飛ばないため）
 *   - 進む向きは右
 */
const WALK_FRAMES = ["/characters/obaasan.png"];

/** 定位置に着いてから見せる、こちらを向いた絵 */
const FRONT_FRAME = "/characters/obaasan.png";

export interface ConsultIntroProps {
  /** 歩いてきて止まる先。ページ内のにちよさん（hero）を囲む要素 */
  targetRef: RefObject<HTMLElement | null>;
  /**
   * にちよさんが定位置に着いた合図。
   * 演出をしなかったとき（動きを減らす設定・測れなかったとき）もすぐに呼ぶので、
   * 受け取る側はこれを「本文を出してよい合図」としてそのまま使える。
   */
  onSettled?: () => void;
}

type Spot = { left: number; top: number; width: number; height: number; startX: number };

/**
 * 相談ページの入り。
 *
 * にちよさんが画面の左の外からとことこ歩いてきて、定位置で止まり、こちらを向く。
 * マップ・検索と違い、この画面は「誰かに相談する」ことが分からないと使えないので、
 * 待っている間に読ませる文章は置かず、相手が来るところだけを見せる。
 *
 * 大きさは最初から定位置と同じ。動かすのは transform と opacity だけで、
 * height / width は動かさない（毎フレーム レイアウトが走り、下の候補ボタンまで
 * 一緒に動いてしまうため）。
 *
 * 動きを減らす設定のときは何も出さない（相談は待たされる画面ではないので、
 * 演出を省いても失われる情報がない）。
 */
export default function ConsultIntro({ targetRef, onSettled }: ConsultIntroProps) {
  const [spot, setSpot] = useState<Spot | null>(null);
  const [walking, setWalking] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [frame, setFrame] = useState(0);
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

    const rect = targetRef.current?.getBoundingClientRect();
    // 止まる先が測れないときは演出を諦めて、そのままページを見せる
    if (!rect || rect.width === 0) {
      setFinished(true);
      onSettledRef.current?.();
      return;
    }

    setSpot({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      startX: computeWalkInStartX(rect),
    });

    const timers: ReturnType<typeof setTimeout>[] = [];
    // 歩き出すのは、画面の外に立っているところが一度描かれたあと。
    // 立ち位置を決めた直後に動かすと、その姿が描かれる前に終点が決まってしまい、
    // transition が乗らず定位置に瞬間移動する（フレームを2つ待つのはこのため）。
    // 裏のタブでは次のフレームが来ないので、時間でも歩き出すようにしておく
    let secondRaf = 0;
    const raf = requestAnimationFrame(() => {
      secondRaf = requestAnimationFrame(() => setWalking(true));
    });
    timers.push(setTimeout(() => setWalking(true), 120));

    // 着いたらコマ送りと揺れを止めて、こちらを向く
    timers.push(
      setTimeout(() => {
        setArrived(true);
        timers.push(
          setTimeout(() => {
            setLeaving(true);
            onSettledRef.current?.();
          }, TURN_MS)
        );
        timers.push(setTimeout(() => setFinished(true), TURN_MS + FADE_MS));
      }, WALK_MS)
    );

    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(secondRaf);
      timers.forEach(clearTimeout);
    };
  }, [targetRef]);

  // 足の入れ替わり。絵が1枚しかない間は回しても何も変わらないので回さない
  useEffect(() => {
    if (WALK_FRAMES.length < 2 || !walking || arrived) return;
    const id = setInterval(() => setFrame((prev) => (prev + 1) % WALK_FRAMES.length), STEP_MS);
    return () => clearInterval(id);
  }, [walking, arrived]);

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
      {spot && (
        <div
          className="absolute"
          style={{
            left: `${spot.left}px`,
            top: `${spot.top}px`,
            width: `${spot.width}px`,
            height: `${spot.height}px`,
            transform: walking ? "translateX(0)" : `translateX(${spot.startX}px)`,
            transition: walking ? `transform ${WALK_MS}ms ${EASING}` : undefined,
          }}
        >
          {/* 一歩ごとの上下の揺れ。着いたら止める */}
          <div className={`consult-intro__step relative h-full w-full${arrived ? " is-arrived" : ""}`}>
            {WALK_FRAMES.map((src, index) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={480}
                height={480}
                priority
                className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(146,64,14,0.25)]"
                style={{
                  opacity: !arrived && index === frame ? 1 : 0,
                  transition: `opacity ${TURN_MS}ms ease-out`,
                }}
              />
            ))}

            {/* 着いたところで、こちらを向く */}
            <Image
              src={FRONT_FRAME}
              alt=""
              width={480}
              height={480}
              priority
              className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_8px_16px_rgba(146,64,14,0.25)]"
              style={{
                opacity: arrived ? 1 : 0,
                transition: `opacity ${TURN_MS}ms ease-out`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
