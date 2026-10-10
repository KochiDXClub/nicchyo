"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, HandHeart } from "lucide-react";

/**
 * 右下に常に出しておく「協賛のご相談」
 *
 * どこまで読んだところで決めても、その場から相談へ進めるようにする。
 * ページの中にも同じボタンがある（入口と、ご支援の方法の2枚のカード）。
 * それが画面に見えているあいだは引っ込み、見えなくなったら出てくる。
 * 二重に並ばず、カードのボタンの上に重なることもない。
 *
 * ページの中のボタンには data-support-cta を付けておくこと。付け忘れると、
 * そのボタンの上にもこのボタンが重なる。
 *
 * 下端は NavigationBar（--nav-bar-height）が占めているので、その上に浮かせる。
 * 動きは「出てくるときに跳ねる」「光が走る」「アイコンから波紋が広がる」の3つ。
 * 光と波紋は出てきたときに数回だけ動いて止まる（globals.css）。
 */

/** ページの中の「協賛のご相談」に付ける目印 */
const INLINE_CTA_SELECTOR = "[data-support-cta]";

/**
 * 最初に出てくるまでの間（ミリ秒）。入口では見出しが落ち、人が歩いてくるので、
 * それが落ち着いてから出す。狭い画面では入口のボタンがナビの裏に隠れていて、
 * 読み込んだ直後からこのボタンが出る条件がそろっている。
 */
const FIRST_APPEAR_DELAY_MS = 1200;

export default function SupportFloatingCta() {
  // 見張りが始まるまでは「見えている」扱いにして、出さないでおく
  const [hasVisibleInlineCta, setHasVisibleInlineCta] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  /**
   * ページの中のボタンを1つずつ見張り、見えているものを数える。
   *
   * 見張るのは高さのある要素なので、ページ内リンク（「費用の内訳を見る」）で
   * 一気に飛んでも、見え方が変わったものには必ず知らせが来る。
   * 下端はナビの高さぶん削って判定する。ナビの裏に隠れたボタンは見えていない。
   */
  useEffect(() => {
    const targets = document.querySelectorAll(INLINE_CTA_SELECTOR);
    if (targets.length === 0) {
      setHasVisibleInlineCta(false);
      return;
    }

    const navHeight = document.querySelector(".navigation-bar")?.getBoundingClientRect().height ?? 56;
    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        setHasVisibleInlineCta(visible.size > 0);
      },
      { rootMargin: `0px 0px -${Math.round(navHeight)}px 0px`, threshold: 0 }
    );
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), FIRST_APPEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isReady && !hasVisibleInlineCta && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.92 }}
          transition={
            prefersReducedMotion
              ? { duration: 0.15 }
              : { type: "spring", stiffness: 380, damping: 24, mass: 0.9 }
          }
          className="fixed z-40 print:hidden"
          style={{
            // デスクトップでメニューが開いているぶんを避ける（globals.css で定義）
            right: "calc(var(--desktop-menu-offset, 0px) + 1rem)",
            bottom: "calc(var(--nav-bar-height) + var(--safe-bottom, 0px) + 1rem)",
          }}
        >
          <Link
            href="/contact?category=sponsor"
            className="group relative flex items-center gap-2.5 overflow-hidden rounded-chip bg-nicchyo-ink py-2 pl-2 pr-5 text-white shadow-float ring-1 ring-white/10 transition duration-200 ease-out-soft hover:-translate-y-0.5 hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 focus-visible:ring-offset-2 active:scale-95 motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
          >
            {/* 光の帯。ボタンの左の外から右の外へ横切る */}
            <span
              className="support-cta__shine pointer-events-none absolute inset-y-0 -left-1/3 w-1/4 bg-white/25 blur-md"
              aria-hidden
            />

            <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-amber-400 text-nicchyo-ink">
              <span
                className="support-cta__ping absolute inset-0 rounded-chip ring-2 ring-amber-400"
                aria-hidden
              />
              <HandHeart className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="relative text-[14px] font-bold">協賛のご相談</span>
            <ArrowRight
              className="relative h-4 w-4 text-white/70 transition group-hover:translate-x-0.5 group-hover:text-white motion-reduce:group-hover:translate-x-0"
              aria-hidden
            />
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
