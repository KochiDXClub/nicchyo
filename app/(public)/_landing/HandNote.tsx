import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { handFont } from "./fonts";

/**
 * 写真の上に「書かれる」手描きのひとこと。文字は左から書き進め（先頭にペン先の黄色い点）、
 * 下線と矢印は線が引かれる。一度書いたらそのまま残る。
 *
 * 動くのは、囲んでいる InView が見えてから（data-visible）。書き始める前に通り過ぎて見逃さないため。
 * 「動きを減らす」設定では、書き終えた形で出す。ふちを濃い色で囲むので、にぎやかな写真の上でも読める。
 * 位置・傾き・大きさは className / size で決める（absolute で置くので、親は relative にする）
 */
export default function HandNote({
  children,
  className,
  delay = 0,
  size = 28,
  underline = true,
  arrowClassName,
}: {
  children: ReactNode;
  className?: string;
  /** 書き始めるまでの秒数 */
  delay?: number;
  /** 文字の大きさ（px）。画面が狭いときは className 側で調整する */
  size?: number;
  underline?: boolean;
  /** 矢印を付けるとき、その位置・向き（Tailwind のクラス） */
  arrowClassName?: string;
}) {
  return (
    <span
      className={cn("landing-hn pointer-events-none absolute z-[4] block", handFont.className, className)}
      style={{ "--d": `${delay}s`, "--fs": `${size}px` } as CSSProperties}
    >
      <span className="landing-wr">
        <span className="landing-hand-t">{children}</span>
      </span>
      {underline ? (
        <svg viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden className="landing-hn-ul">
          <path className="landing-hn-p landing-hn-dark" pathLength="1" d="M2 6C20 1 40 9 60 5S100 2 118 6" />
          <path className="landing-hn-p" pathLength="1" d="M2 6C20 1 40 9 60 5S100 2 118 6" />
        </svg>
      ) : null}
      {arrowClassName ? (
        <svg viewBox="0 0 100 70" aria-hidden className={cn("landing-hn-arrow absolute", arrowClassName)}>
          <path className="landing-hn-p landing-hn-dark" pathLength="1" d="M6 10C30 2 70 12 86 52M86 52L72 46M86 52L90 36" />
          <path className="landing-hn-p" pathLength="1" d="M6 10C30 2 70 12 86 52M86 52L72 46M86 52L90 36" />
        </svg>
      ) : null}
    </span>
  );
}
