"use client";

import { useRef, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * スクロールに合わせて一度だけ動く部品（Reveal の仲間）
 *
 * 協賛・ご支援のページで、節の見出しを下からせり上がらせるために作った。
 * 一度きり（once）で、読み終えた場所が戻ってきてももう一度動くことはない。
 *
 * Reveal と同じ決まりに従う。
 * - 動きを減らす設定でも initial は外さず、時間だけを 0 にする（サーバーでは設定が
 *   読めないので、最初の描画はどちらも同じにそろえるしかない）
 * - 動かす要素には reveal を付ける。印刷では globals.css がこの名前を見て
 *   opacity と transform を戻すので、スクロールしていない所も紙に出る
 */

/** Reveal と同じ緩急 */
const MOTION_EASE = [0.22, 1, 0.36, 1] as const;
/** Reveal と同じ。画面の下端から 1割入ったところで動き出す */
const MOTION_VIEWPORT_MARGIN = "0px 0px -10% 0px";

/**
 * 窓の下からせり上がる見出し。
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
  const isInView = useInView(ref, { once: true, margin: MOTION_VIEWPORT_MARGIN });
  const prefersReducedMotion = useReducedMotion();

  return (
    <h2 ref={ref} className={className}>
      <span className="block -mb-[0.14em] overflow-hidden pb-[0.14em]">
        <motion.span
          className="reveal inline-block"
          initial={{ y: "105%" }}
          animate={isInView ? { y: 0 } : undefined}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.7, ease: MOTION_EASE }}
        >
          {children}
        </motion.span>
      </span>
    </h2>
  );
}
