"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils/cn";
import { GRANDMA_COMMENTS, type LandingSectionKey } from "./content";

/** 絵を描く大きさ（px）。着地点・右下の大きさへは transform の scale で合わせる */
const BASE_SIZE = 112;
/** 飛んでいく時間。着地点が変わったときだけ transition を付け、着いたら外す */
const FLIGHT_MS = 560;
/**
 * 着地してよい範囲（画面の高さに対する割合）。着地点がこの中に収まっているときだけ降りる。
 * 画面の端に半分だけ見えている着地点へ降りると、すぐまた飛び立つことになり落ち着かない
 */
const LANDING_ZONE = { top: 0.1, bottom: 0.9 };
/** これより低い画面（横向きのスマホなど）では、右下に出さない。画面の下がふさがる */
const MIN_DOCK_VIEWPORT_HEIGHT = 480;

type Mode = "hidden" | "landed" | "docked";

/**
 * トップページを一緒に歩くにちよさん。
 *
 * - 各セクションの着地点（GrandmaPerch）が画面の中ほどに見えているときは、そこへ降りる
 * - 見えていないときは画面の右下に留まり、いま読んでいるセクションに合わせてひとこと言う。
 *   右下にいるときは押せて、相談画面をひらく（協賛ページの右下の「ご支援のご相談」と同じ置き方）
 *
 * 位置は transform だけで動かす（スクロールのたびに再描画しないよう、state にはしない）。
 * 状態（どこにいるか・どのセクションか）が変わったときだけ state を更新する。
 * 動きを減らす設定のときは、飛ばずにその場へ移る
 */
export default function LandingGrandma({ farewell }: { farewell: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<Mode>("hidden");
  const [section, setSection] = useState<LandingSectionKey>("hero");
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    const dock = dockRef.current;
    if (!root || !dock) return;

    let frame = 0;
    let flightTimer: number | undefined;
    let lastKey = "";

    const update = () => {
      frame = 0;
      const viewportHeight = window.innerHeight;

      // 着地できる着地点のうち、画面の中央にいちばん近いもの
      let perch: { key: LandingSectionKey; rect: DOMRect } | null = null;
      let bestDistance = Infinity;
      document.querySelectorAll<HTMLElement>("[data-grandma-perch]").forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0) return;
        if (rect.top < viewportHeight * LANDING_ZONE.top || rect.bottom > viewportHeight * LANDING_ZONE.bottom) return;
        const distance = Math.abs((rect.top + rect.bottom) / 2 - viewportHeight / 2);
        if (distance < bestDistance) {
          bestDistance = distance;
          perch = { key: element.dataset.grandmaPerch as LandingSectionKey, rect };
        }
      });

      let nextMode: Mode;
      let nextSection: LandingSectionKey;
      let target: DOMRect;
      if (perch) {
        const landed = perch as { key: LandingSectionKey; rect: DOMRect };
        nextMode = "landed";
        nextSection = landed.key;
        target = landed.rect;
      } else {
        // 右下の位置は、同じ大きさの見えない箱（dock）を CSS で置いて測る。切り欠きの余白も CSS が持つ
        nextMode = viewportHeight < MIN_DOCK_VIEWPORT_HEIGHT ? "hidden" : "docked";
        nextSection = currentSection(viewportHeight);
        target = dock.getBoundingClientRect();
      }

      const key = `${nextMode}:${nextMode === "landed" ? nextSection : ""}`;
      if (key !== lastKey) {
        const isFirst = lastKey === "";
        lastKey = key;
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (!isFirst && !reduceMotion) {
          root.style.transition = `transform ${FLIGHT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms`;
          window.clearTimeout(flightTimer);
          flightTimer = window.setTimeout(() => {
            root.style.transition = "opacity 200ms";
            // 降りたところで小さく跳ねる
            if (nextMode === "landed") {
              figureRef.current?.animate(
                [{ transform: "translateY(0)" }, { transform: "translateY(-12%)" }, { transform: "translateY(0)" }],
                { duration: 360, easing: "ease-out" }
              );
            }
          }, FLIGHT_MS);
        }
      }

      root.style.transform = `translate3d(${target.left}px, ${target.top}px, 0) scale(${target.width / BASE_SIZE})`;
      setMode(nextMode);
      setSection(nextSection);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // 写真の読み込みなどで着地点の位置がずれたときにも追いかける
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    resizeObserver?.observe(document.body);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(flightTimer);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      resizeObserver?.disconnect();
    };
  }, []);

  const docked = mode === "docked";
  const comment = section === "message" ? farewell : GRANDMA_COMMENTS[section];

  return (
    <>
      {/* 右下の定位置。見えない箱で、ここを測って右下へ動かす */}
      <div
        ref={dockRef}
        aria-hidden
        className="pointer-events-none invisible fixed h-[72px] w-[72px] md:h-[88px] md:w-[88px]"
        style={{ right: "calc(var(--safe-right, 0px) + 1rem)", bottom: "calc(var(--safe-bottom, 0px) + 1rem)" }}
      />

      <div
        ref={rootRef}
        className={cn(
          "fixed left-0 top-0 z-30 origin-top-left print:hidden",
          mode === "hidden" && "opacity-0",
          !docked && "pointer-events-none"
        )}
        style={{ width: BASE_SIZE, height: BASE_SIZE }}
      >
        {/* 右下にいるときだけ押せる。降りているあいだは飾りなので、押せず読ませもしない */}
        <Link
          href="/consult"
          aria-label="にちよさんに相談する"
          aria-hidden={!docked}
          tabIndex={docked ? 0 : -1}
          className="block h-full w-full rounded-chip focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/60"
        >
          <div ref={figureRef} className="h-full w-full">
            <Image
              src="/images/obaasan_transparent.webp"
              alt=""
              width={BASE_SIZE}
              height={BASE_SIZE}
              priority
              className="h-full w-full object-contain drop-shadow-md"
            />
          </div>
        </Link>
      </div>

      {/* 右下にいるときのひとこと。にちよさんの左上に出す */}
      <AnimatePresence mode="wait">
        {docked && (
          <motion.div
            key={section}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: 0.22 }}
            className="fixed z-30 max-w-[15rem] origin-bottom-right [--grandma-dock-size:72px] print:hidden md:max-w-[17rem] md:[--grandma-dock-size:88px]"
            style={{
              right: "calc(var(--safe-right, 0px) + 1rem + var(--grandma-dock-size) - 0.5rem)",
              bottom: "calc(var(--safe-bottom, 0px) + 1rem + var(--grandma-dock-size) - 0.75rem)",
            }}
          >
            <Link
              href="/consult"
              tabIndex={-1}
              className="relative block rounded-card bg-white px-4 py-2.5 text-[13px] font-bold leading-relaxed text-nicchyo-ink shadow-float ring-1 ring-line"
            >
              {comment}
              {/* しっぽ。右下のにちよさんへ向ける */}
              <span
                aria-hidden
                className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-line bg-white"
              />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** 画面の中央の高さにあるセクション。どれにも当たらなければ一番近い手前のもの */
function currentSection(viewportHeight: number): LandingSectionKey {
  const middle = viewportHeight / 2;
  let found: LandingSectionKey = "hero";
  document.querySelectorAll<HTMLElement>("[data-grandma-section]").forEach((element) => {
    if (element.getBoundingClientRect().top <= middle) {
      found = element.dataset.grandmaSection as LandingSectionKey;
    }
  });
  return found;
}
