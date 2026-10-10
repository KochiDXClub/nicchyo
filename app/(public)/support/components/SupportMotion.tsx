"use client";

import { useEffect, useRef, type ReactNode } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

/**
 * 支援ページの動きの部品
 *
 * 節ごとに「見出しがせり上がる → 数字が数え上がる → 棒が伸びる」の順に動かして、
 * スクロールするたびに何かが起きるページにする。どれも一度きり（once）で、
 * 読み終えた場所が戻ってきてもう一度動くことはない。
 *
 * Reveal と同じ決まりに従う。
 * - 動きを減らす設定でも initial は外さず、時間だけを 0 にする（サーバーでは設定が
 *   読めないので、最初の描画はどちらも同じにそろえるしかない）
 * - 動かす要素には reveal を付ける。印刷では globals.css がこの名前を見て
 *   opacity と transform を戻すので、スクロールしていない所も紙に出る
 */

const EASE = [0.22, 1, 0.36, 1] as const;
/** Reveal と同じ。画面の下端から 1割入ったところで動き出す */
const VIEWPORT_MARGIN = "0px 0px -10% 0px";

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("ja-JP", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * 画面に入ったら 0 から数え上がる数字。
 *
 * サーバーは最終の値を書く（スクリプトが届く前や、届かないときも正しい数が出る）。
 * 0 に戻すのは読み込みの直後で、そのときはまだ外側の Reveal や入口の出現が
 * 透明なので、最終の値から 0 へ跳ぶところは見えない。画面に入るのを待ってから
 * 戻すと、狭い画面で入口の下の方にある数字が、見えている状態から 0 に跳ぶ。
 *
 * 0 に戻したまま印刷されると数字が消えるので、印刷の直前に最終の値へ戻す。
 * 数えている途中の数は読み上げさせない。読み上げには最終の値だけを渡す。
 */
export function CountUp({
  value,
  decimals = 0,
  suffix = "",
  delay = 0,
}: {
  value: number;
  /** 小数の桁数。月数は 1、金額と人数は 0 */
  decimals?: number;
  /** 単位。「円」「円以上」など */
  suffix?: string;
  /** 外側の出現に合わせて、数え始めを遅らせる（秒） */
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN });
  const prefersReducedMotion = useReducedMotion();
  const count = useMotionValue(value);
  const text = useTransform(count, (current) => `${formatNumber(current, decimals)}${suffix}`);

  // 0 は数える意味がない。動きを減らす設定の方には、最初から最終の値を置いておく
  const shouldCount = !prefersReducedMotion && value !== 0;
  const controlsRef = useRef<ReturnType<typeof animate> | null>(null);

  useEffect(() => {
    if (!shouldCount) return;
    count.set(0);
    const showFinal = () => {
      controlsRef.current?.stop();
      count.set(value);
    };
    window.addEventListener("beforeprint", showFinal);
    return () => window.removeEventListener("beforeprint", showFinal);
  }, [shouldCount, value, count]);

  useEffect(() => {
    if (!isInView || !shouldCount) return;
    const controls = animate(count, value, { duration: 1.4, ease: EASE, delay });
    controlsRef.current = controls;
    return () => controls.stop();
  }, [isInView, shouldCount, value, delay, count]);

  return (
    <span ref={ref}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{`${formatNumber(value, decimals)}${suffix}`}</span>
    </span>
  );
}

/**
 * 左から伸びる棒。幅は ratio（0〜1）で決める。
 *
 * 伸ばすのは scaleX で、幅そのものは最初から決めておく。幅を動かすと、
 * 伸びているあいだ周りの行が組み直されてしまう。
 *
 * 画面に入ったかは、縮めていない外側で見る。幅 0 に潰した棒そのものを見ると、
 * ブラウザによっては「見えていない」のまま伸びない。
 */
export function GrowBar({
  ratio,
  className = "",
  delay = 0,
}: {
  ratio: number;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN });
  const prefersReducedMotion = useReducedMotion();

  return (
    <span ref={ref} className="block h-full">
      <motion.span
        className={`reveal block h-full origin-left ${className}`}
        style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%` }}
        initial={{ scaleX: 0 }}
        animate={isInView ? { scaleX: 1 } : undefined}
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.9, ease: EASE, delay }}
      />
    </span>
  );
}

/**
 * 窓の下からせり上がる見出し。入口の見出しが上から落ちてくるのと対にしてある。
 *
 * 折り返す長さの見出しでも、かたまりごと持ち上げるので形は崩れない。
 * 下の余白は、はみ出す字（ら・す の下端）が窓で切れないぶんだけ。
 *
 * 画面に入ったかは、動かす字ではなく見出しの側で見る。字は窓の外に隠れていて、
 * 窓に切られた要素は画面の中にあっても「見えていない」と判定されるため、
 * 字の側で見ると最後までせり上がらない。
 */
export function RiseHeading({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const isInView = useInView(ref, { once: true, margin: VIEWPORT_MARGIN });
  const prefersReducedMotion = useReducedMotion();

  return (
    <h2 ref={ref} className={className}>
      <span className="block -mb-[0.14em] overflow-hidden pb-[0.14em]">
        <motion.span
          className="reveal inline-block"
          initial={{ y: "105%" }}
          animate={isInView ? { y: 0 } : undefined}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: EASE }}
        >
          {children}
        </motion.span>
      </span>
    </h2>
  );
}
