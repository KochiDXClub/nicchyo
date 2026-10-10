"use client";

/**
 * 1年ぶんの運営費のうち、支援でまかなえている月数を出すメーター
 *
 * このページで唯一の図。必要額（12ヶ月ぶんの目盛り全体）と、集まっている額
 * （塗られたぶん）を1つの図で同時に見せるため、棒グラフを2本並べる形は取らない。
 *
 * 目盛りは月。連続したバーだと「◯円集まった」までしか伝わらないが、
 * 月で刻むと「あと何ヶ月動かせるか」がそのまま読める。
 *
 * 塗りは誰が出した分かで色を分ける。協賛した相手にとっては、自分の色が
 * サイトを何ヶ月ぶん支えているかが見えることが掲載の意味になる。
 * 色だけに頼らないよう、名前と金額は必ず下の凡例に並べること（呼び出し側の責任）。
 *
 * 支援が 0 のあいだ図が空のままだと「動いていない」としか読めないため、
 * 協賛1口ぶんの伸びしろを ghostMonths として斜線で重ねられるようにしてある
 * （金額が決まるまでは呼び出し側が渡さないので、何も出ない）。
 *
 * 画面に入ったら、左の月から順に目盛りが立ち上がる。12ヶ月という長さを、
 * 1ヶ月ずつ数えるように見せるため。斜線の伸びしろは、まだ埋まっていない
 * ことが伝わるよう、目盛りが立ち上がったあとに2回だけ流す（globals.css の
 * support-ghost-flow）。流し続けると、ほかを読んでいるあいだも目を引いてしまう。
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION_EASE, MOTION_VIEWPORT_MARGIN } from "@/components/ScrollMotion";
import type { FundingSegment } from "@/lib/support/supporters";

type RunwayMeterProps = {
  /** 塗り。入っている順に左から積む */
  segments: FundingSegment[];
  /** 目盛りの総月数 */
  totalMonths: number;
  /** 協賛1口が入ったときに伸びる月数。未定なら渡さない */
  ghostMonths?: number;
};

/** 目盛りに数字を振る位置。全部の月に振ると図が読めなくなるので四半期だけ */
const TICK_EVERY = 3;

/** 1ヶ月ぶんの目盛りが立ち上がる間隔（秒） */
const STAGGER = 0.045;

export default function RunwayMeter({ segments, totalMonths, ghostMonths }: RunwayMeterProps) {
  const prefersReducedMotion = useReducedMotion();
  // 画面に入ってから斜線を流す。読み込んだ時点で流しても、見ていないうちに終わる
  const [hasEntered, setHasEntered] = useState(false);

  // 各区間の開始・終了を月単位で持つ。目盛りをはみ出したぶんは切る
  let cursor = 0;
  const spans = segments.map((segment) => {
    const start = cursor;
    cursor = Math.min(cursor + segment.months, totalMonths);
    return { ...segment, start, end: cursor };
  });
  const covered = cursor;

  // 伸びしろは塗りの続きから。こちらも目盛りをはみ出さない
  const ghostEnd = ghostMonths ? Math.min(covered + ghostMonths, totalMonths) : covered;

  const ticks = Array.from(
    { length: Math.floor(totalMonths / TICK_EVERY) },
    (_, index) => (index + 1) * TICK_EVERY
  );

  return (
    <div
      role="img"
      aria-label={
        `${totalMonths}ヶ月ぶんの運営費のうち、ご支援でまかなえているのは ${covered.toFixed(1)}ヶ月ぶん` +
        (ghostEnd > covered
          ? `。ご協賛1口が入ると ${ghostEnd.toFixed(1)}ヶ月ぶんまで伸びます`
          : "")
      }
    >
      <motion.div
        className="flex gap-[3px]"
        viewport={{ once: true, margin: MOTION_VIEWPORT_MARGIN }}
        onViewportEnter={() => setHasEntered(true)}
      >
        {Array.from({ length: totalMonths }, (_, month) => (
          <motion.div
            key={month}
            // 印刷では globals.css が reveal を見て、立ち上がる前の形を戻す
            className="reveal relative h-12 flex-1 origin-bottom overflow-hidden rounded-[3px] bg-nicchyo-ink/[0.06]"
            initial={{ opacity: 0, scaleY: 0.2 }}
            whileInView={{ opacity: 1, scaleY: 1 }}
            viewport={{ once: true, margin: MOTION_VIEWPORT_MARGIN }}
            transition={
              prefersReducedMotion
                ? { duration: 0 }
                : { duration: 0.5, ease: MOTION_EASE, delay: 0.15 + month * STAGGER }
            }
          >
            {/* 伸びしろ。塗りの下に敷くので、塗りが増えれば自然に隠れる */}
            {ghostEnd > covered && (() => {
              const from = Math.max(covered, month);
              const to = Math.min(ghostEnd, month + 1);
              if (to <= from) return null;
              return (
                <div
                  className={`${hasEntered ? "support-ghost-flow" : ""} absolute inset-y-0 bg-[repeating-linear-gradient(-45deg,rgba(217,119,6,0.22)_0_5px,rgba(217,119,6,0.06)_5px_10px)]`}
                  style={{
                    left: `${(from - month) * 100}%`,
                    width: `${(to - from) * 100}%`,
                  }}
                />
              );
            })()}

            {spans.map((span) => {
              // このセル（month 〜 month+1）と重なっているぶんだけ塗る
              const from = Math.max(span.start, month);
              const to = Math.min(span.end, month + 1);
              if (to <= from) return null;
              // 区間の境目には地色の隙間を入れる。隣り合う色は色覚特性によっては
              // 差が小さくなるため、色だけで切れ目を示さない
              const startsHere = span.start > month;
              return (
                <div
                  key={span.label}
                  className="absolute inset-y-0"
                  style={{
                    left: `${(from - month) * 100}%`,
                    width: `${(to - from) * 100}%`,
                    backgroundColor: span.color,
                    boxSizing: "border-box",
                    borderLeft: startsHere ? "2px solid #FFFAF0" : undefined,
                  }}
                />
              );
            })}
          </motion.div>
        ))}
      </motion.div>

      {/* 目盛り。四半期ごとにだけ数字を振る */}
      <div className="mt-2.5 flex text-[11px] tabular-nums text-nicchyo-ink/35">
        {ticks.map((tick) => (
          <span
            key={tick}
            className="text-right"
            style={{ width: `${(TICK_EVERY / totalMonths) * 100}%` }}
          >
            {tick}ヶ月
          </span>
        ))}
      </div>
    </div>
  );
}
