"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * 画面に入ったときに、少し下から浮かび上がらせる
 *
 * 長いページを上から順に読ませるための下地。1要素ずつ派手に動かすのではなく、
 * かたまりごとに一度だけ、短く動かす。二度目は動かさない（once）。
 *
 * 動きを減らす設定のときは initial を false にして、最初から見えている状態で置く。
 * 要素の構造は変えないので、ハイドレーションのずれは起きない。
 *
 * ※ position: sticky を含むかたまりは包まないこと。transform が効いているあいだ、
 *   貼り付く基準が変わる。
 */

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** 続けて出したいときに、少しずらす（秒） */
  delay?: number;
};

export default function Reveal({ children, className, delay = 0 }: RevealProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      // 印刷では演出を消す必要がある（画面に入っていない節が opacity:0 のまま
      // 紙に出てしまう）。globals.css の @media print がこの名前を見ている
      className={className ? `reveal ${className}` : "reveal"}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
