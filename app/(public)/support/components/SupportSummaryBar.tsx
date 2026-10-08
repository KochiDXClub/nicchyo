"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * 入口を過ぎたあとに上へ出る要約バー
 *
 * このページは縦に長い。下まで読んだ人が判断したくなったとき、いちいち先頭へ
 * 戻らないと数字も相談先も無いのは不親切なので、要点だけを連れて回る。
 *
 * NavigationBar が下端を占有している（--nav-bar-height）ため、追従させるなら
 * 上しかない。入口が見えているあいだは邪魔なだけなので出さない。
 */

type SupportSummaryBarProps = {
  monthlyLabel: string;
  runwayLabel: string;
  totalMonths: number;
  /** 入口の末尾に置いた目印の id。これが上へ抜けたら出す */
  sentinelId: string;
};

export default function SupportSummaryBar({
  monthlyLabel,
  runwayLabel,
  totalMonths,
  sentinelId,
}: SupportSummaryBarProps) {
  const [isPastHero, setIsPastHero] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const sentinel = document.getElementById(sentinelId);
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        // 下から近づいてくる場合（画面より下にある）は出さない。
        // 上へ抜けたときだけ true にする
        setIsPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelId]);

  return (
    <AnimatePresence>
      {isPastHero && (
        <motion.div
          initial={prefersReducedMotion ? false : { y: "-100%" }}
          animate={{ y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { y: "-100%" }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed left-0 top-0 z-40 border-b border-nicchyo-ink/[0.09] bg-nicchyo-base/85 backdrop-blur-md print:hidden"
          style={{
            // デスクトップでメニューが開いているぶんを避ける（globals.css で定義）
            right: "var(--desktop-menu-offset, 0px)",
            paddingTop: "var(--safe-top, 0px)",
          }}
        >
          <div className="mx-auto flex max-w-[64rem] items-center gap-5 px-6 py-2.5 sm:px-8">
            <dl className="flex min-w-0 items-center gap-5 sm:gap-7">
              <div className="min-w-0">
                <dt className="text-[10px] leading-tight tracking-[0.06em] text-nicchyo-ink/45">
                  毎月の運営費
                </dt>
                <dd className="text-[15px] font-bold leading-tight tabular-nums">{monthlyLabel}</dd>
              </div>
              <div className="hidden min-w-0 sm:block">
                <dt className="text-[10px] leading-tight tracking-[0.06em] text-nicchyo-ink/45">
                  ご支援いただいている期間
                </dt>
                <dd className="text-[15px] font-bold leading-tight tabular-nums">
                  {runwayLabel}
                  <span className="ml-1 text-[11px] font-bold text-nicchyo-ink/35">
                    / {totalMonths}ヶ月
                  </span>
                </dd>
              </div>
            </dl>

            <Link
              href="/contact?category=sponsor"
              className="ml-auto shrink-0 rounded-xl bg-nicchyo-ink px-4 py-2 text-[12.5px] font-bold text-white transition hover:bg-nicchyo-ink/90 active:scale-[0.98]"
            >
              協賛のご相談
            </Link>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
