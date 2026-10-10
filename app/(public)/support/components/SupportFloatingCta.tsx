"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, HandHeart } from "lucide-react";

/**
 * 右下に常に出しておく「協賛のご相談」
 *
 * どこまで読んだところで決めても、その場から相談へ進めるようにする。
 * 入口には同じボタンが既にあるので、入口が見えているあいだは出さない。
 *
 * 下端は NavigationBar（--nav-bar-height）が占めているので、その上に浮かせる。
 * 動きは「出てくるときに跳ねる」「ときどき光が走る」「アイコンから波紋が広がる」の3つ。
 * 光と波紋は目を引くための常時の動きなので、動きを減らす設定では globals.css が止める。
 */

type SupportFloatingCtaProps = {
  /** 入口を包む要素の id。これが画面の上へ抜けたら出す */
  heroId: string;
};

export default function SupportFloatingCta({ heroId }: SupportFloatingCtaProps) {
  const [isPastHero, setIsPastHero] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  /**
   * 高さの無い目印ではなく、入口そのものを見張る。
   * 目印だと、ページ内リンク（「費用の内訳を見る」）や勢いのあるスクロールで
   * 画面の下から上へ一気に飛び越えたとき、交差の前後どちらも「見えていない」の
   * ままなので知らせが来ず、ボタンが出ない。入口は読み込んだ時点で画面に
   * 入っているので、離れれば必ず知らせが来る。
   */
  useEffect(() => {
    const hero = document.getElementById(heroId);
    if (!hero) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 上へ抜けたときだけ true にする
        setIsPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroId]);

  return (
    <AnimatePresence>
      {isPastHero && (
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
            {/* 光の帯。ボタンの左の外から右の外へ、ときどき横切る */}
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
