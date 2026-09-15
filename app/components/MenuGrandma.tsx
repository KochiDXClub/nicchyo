"use client";

/**
 * メニューの余白に座っているにちよさん。
 *
 * 押すとひとことだけ吹き出しが出て、すぐ消える。続けて押されたら消えるのを待たずに
 * 次のセリフへ差し替える。行き先は持たせない（相談はナビの「相談」から入る）。
 */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";

/** 押されたときのひとこと。吹き出しがすぐ消えるので、ひと目で読み切れる長さにする */
const GRANDMA_LINES = [
  "おや、なんぞ用かえ",
  "こちょばいがよ",
  "よう来たねぇ",
  "まだ押すがか",
  "ええ天気やねぇ",
  "ゆっくりしていきや",
  "わしゃ ここにおるよ",
  "まっことよう押すねぇ",
  "そろそろ日曜市いこか",
  "おなかすいたねぇ",
  "ひと休みしよか",
  "かんにんしてや",
  "ちょっと目がまわるが",
  "押しても何も出んよ",
];

/** 吹き出しが消えるまでの時間 */
const BUBBLE_MS = 1500;

export default function MenuGrandma() {
  const [line, setLine] = useState<string | null>(null);
  // 開くたびに同じセリフから始まらないよう、初回だけ適当な位置から回す
  const indexRef = useRef(Math.floor(Math.random() * GRANDMA_LINES.length));
  const timerRef = useRef<number | null>(null);
  const controls = useAnimationControls();
  const prefersReducedMotion = useReducedMotion();

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  const handleTap = () => {
    indexRef.current = (indexRef.current + 1) % GRANDMA_LINES.length;
    setLine(GRANDMA_LINES[indexRef.current]);

    // 押し直されたら、前の吹き出しの残り時間ではなく押した時点から数え直す
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setLine(null);
    }, BUBBLE_MS);

    if (!prefersReducedMotion) {
      void controls.start({
        y: [0, -9, 0, -3, 0],
        rotate: [0, -3.5, 2, -1, 0],
        transition: { duration: 0.52, ease: "easeOut" },
      });
    }
  };

  return (
    <div className="relative shrink-0">
      {/* 吹き出し。連打されたときは出し直さず、中の文字だけ差し替える */}
      <AnimatePresence>
        {line && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: "easeOut" }}
            style={{ transformOrigin: "bottom right" }}
            className="pointer-events-none absolute bottom-full right-6 z-10 mb-1 w-max max-w-[13rem]"
            aria-hidden
          >
            {/* しっぽ。上半分は吹き出し本体（relative で上に重なる）に隠れる */}
            <span
              className="absolute right-5 top-full -mt-[6px] block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white ring-1 ring-nicchyo-ink/[0.08]"
              aria-hidden
            />
            <p className="relative rounded-2xl bg-white px-3 py-2 text-[12px] font-medium leading-snug text-nicchyo-ink shadow-[0_4px_14px_-6px_rgba(58,58,58,0.4)] ring-1 ring-nicchyo-ink/[0.08]">
              {line}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleTap}
        animate={controls}
        aria-label="にちよさん"
        className="-mb-2 -mr-3 block"
      >
        <Image
          src="/images/obaasan_transparent.png"
          alt=""
          width={288}
          height={288}
          draggable={false}
          className="h-36 w-36 select-none object-contain"
          aria-hidden
        />
      </motion.button>
    </div>
  );
}
