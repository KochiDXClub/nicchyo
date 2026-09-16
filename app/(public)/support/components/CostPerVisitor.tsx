"use client";

import { useId, useState } from "react";
import { costPerVisitorJpy, formatJpy, formatPerVisitorJpy } from "../costs";

/**
 * 「日曜市に来た方の何割が使ったら、ひとりあたりいくらか」
 *
 * 10,047円 という月額は、それだけ見ても高いのか安いのか判断できない。
 * 人数で割ると初めて比べられる数になる。
 *
 * つまみは人数ではなく割合にしてある。「3,000人」と言われても多いのか少ないのか
 * 分からないが、「来場者の5%」なら、読む側が自分の感覚で妥当性を測れる。
 * 人数は割合から出して併記する。
 *
 * この割り算が意味を持つのは、費目がほぼ全部固定費だから。人が増えても月額は
 * ほとんど動かないので、「使われるほど軽くなる」がそのまま成り立つ。
 * 変動するのは OpenAI の従量分だけで、月額に対しては誤差の範囲になる。
 *
 * 人のかたちは常に100個並べ、割合と同じ数だけ塗る（1かたち = 1%）。増減で並びが
 * 動くと、つまみを操作するたびに図が跳ねて読めなくなる。塗られていないぶんは
 * 「まだ届いていない人」として薄く残す（RunwayMeter の空きマスと同じ考え方）。
 */

/** 高知市の公表値。日曜市1回あたりの来場者数 */
const VISITORS_PER_MARKET_DAY = 17_000;
/** 月に日曜が5回ある月を基準にする。多い方で見ておけば、割合を大きく見せずに済む */
const MARKET_DAYS_PER_MONTH = 5;
/** 1ヶ月の来場者数（のべ） */
const MONTHLY_MARKET_VISITORS = VISITORS_PER_MARKET_DAY * MARKET_DAYS_PER_MONTH;

/** かたちの数 = 100。1つが全体の1%にあたる */
const FIGURE_COUNT = 100;

/** つまみの初期位置（%）。実績が取れていればそちらを使う */
const DEFAULT_PERCENT = 15;

/** いま見込んでいる範囲。つまみの目盛りに帯として出す */
const EXPECTED_RANGE = { from: 5, to: 30 };

type CostPerVisitorProps = {
  /** 1ヶ月の運営費（円） */
  monthlyCostJpy: number;
  /** 今月これまでの実績。取れていれば初期位置に使う */
  actualMonthlyVisitors: number | null;
};

/** 人のかたち。頭と肩だけの単純な形にして、100個並べても潰れないようにする */
function PersonGlyph({
  className,
  style,
}: {
  className: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 12 24" fill="currentColor" aria-hidden className={className} style={style}>
      <circle cx="6" cy="4.6" r="3.9" />
      <path d="M6 10.6c-3.3 0-5.9 2.3-5.9 5.3V23c0 .55.45 1 1 1h9.8c.55 0 1-.45 1-1v-7.1c0-3-2.6-5.3-5.9-5.3Z" />
    </svg>
  );
}

export default function CostPerVisitor({
  monthlyCostJpy,
  actualMonthlyVisitors,
}: CostPerVisitorProps) {
  const sliderId = useId();
  const [percent, setPercent] = useState(() => {
    if (actualMonthlyVisitors === null || actualMonthlyVisitors <= 0) return DEFAULT_PERCENT;
    const fromActual = Math.round((actualMonthlyVisitors / MONTHLY_MARKET_VISITORS) * 100);
    return Math.min(Math.max(fromActual, 0), 100);
  });

  const visitors = Math.round((MONTHLY_MARKET_VISITORS * percent) / 100);
  const perVisitor = costPerVisitorJpy(monthlyCostJpy, visitors);
  const visitorsLabel = visitors.toLocaleString("ja-JP");

  return (
    <div>
      <p className="text-[14px] leading-[1.9] text-nicchyo-ink/55">
        日曜市にいらっしゃる方の{" "}
        <strong className="font-bold tabular-nums text-nicchyo-ink">{percent}%</strong>
        、月に <strong className="font-bold tabular-nums text-nicchyo-ink">{visitorsLabel}人</strong>{" "}
        に使っていただいた場合、
      </p>

      {/* このかたまりの主役。ページの中でいちばん大きい数字にする */}
      <p className="mt-3 flex items-baseline gap-2.5">
        <span className="text-[3.25rem] font-bold leading-none tabular-nums sm:text-[4rem]">
          {perVisitor === null ? "—" : formatPerVisitorJpy(perVisitor)}
        </span>
        <span className="text-[14px] font-bold text-nicchyo-ink/45">
          {perVisitor === null ? "まだどなたにも届いていない状態です" : "おひとり / 1ヶ月"}
        </span>
      </p>

      {/* 群衆。1かたちが1%なので、塗られた数がそのまま割合になる */}
      <div
        role="img"
        aria-label={`日曜市の来場者のうち ${percent}%（およそ${visitorsLabel}人）を、ひとかたち1%として ${FIGURE_COUNT} かたちで表した図`}
        // 列数は FIGURE_COUNT を割り切れる数だけにする。auto-fill に任せると
        // 最後の行だけ数個で終わり、意図した形に見えない
        className="mt-9 grid grid-cols-[repeat(10,minmax(0,1fr))] gap-y-1.5 sm:grid-cols-[repeat(20,minmax(0,1fr))] lg:grid-cols-[repeat(25,minmax(0,1fr))]"
      >
        {Array.from({ length: FIGURE_COUNT }, (_, index) => (
          // かたちそのものを押せるようにする。つまみを掴まなくても、見えている
          // 位置を直接指させる方が早い。
          // キーボードと読み上げにはつまみ（range）が本体なので、こちらは
          // tabIndex=-1 でタブ順から外す。親が role="img" なので中身は読み上げ
          // されず、同じ操作が二重に現れることもない
          <button
            key={index}
            type="button"
            tabIndex={-1}
            title={`${index + 1}%`}
            onClick={() => setPercent(index + 1)}
            className="flex w-full cursor-pointer justify-center py-1 focus:outline-none"
          >
            <PersonGlyph
              className={`h-5 w-auto transition-colors duration-500 motion-reduce:transition-none sm:h-6 ${
                // 届いていないぶんは、地に沈むくらいまで薄くする。濃いと
                // 「もう一つの群衆」に見えて、塗られたぶんの意味が薄れる
                index < percent ? "text-[#D97706]" : "text-nicchyo-ink/[0.06]"
              }`}
              // 左から順に色が回るくらいの、ごく短い遅れ。押した位置まで
              // 塗りが流れていくように見せる（動きを減らす設定では transition
              // ごと切れるので、この遅れも効かない）
              style={{ transitionDelay: `${Math.min(index, 30) * 8}ms` }}
            />
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11.5px] leading-relaxed text-nicchyo-ink/40">
        ひとかたち = 全体の1%（およそ
        {Math.round(MONTHLY_MARKET_VISITORS / 100).toLocaleString("ja-JP")}人）。
        かたちを押すと、その割合に切り替わります。
      </p>

      {/* つまみ。割合を動かすと上の数字と図が同時に変わる */}
      <div className="mt-8">
        <label htmlFor={sliderId} className="sr-only">
          日曜市にいらっしゃる方のうち、nicchyo を使ってくださる割合
        </label>
        <div className="relative">
          {/* 見込んでいる範囲を、目盛りの帯として先に敷く */}
          <div
            className="pointer-events-none absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[#D97706]/20"
            style={{
              left: `${EXPECTED_RANGE.from}%`,
              width: `${EXPECTED_RANGE.to - EXPECTED_RANGE.from}%`,
            }}
            aria-hidden
          />
          <input
            id={sliderId}
            type="range"
            min={0}
            max={100}
            step={1}
            value={percent}
            onChange={(event) => setPercent(Number(event.target.value))}
            aria-valuetext={`${percent}パーセント、およそ${visitorsLabel}人`}
            className="relative h-1.5 w-full cursor-pointer appearance-none rounded-full bg-nicchyo-ink/10"
            style={{ accentColor: "#D97706" }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11.5px] tabular-nums text-nicchyo-ink/40">
          <span>0%</span>
          <span className="text-nicchyo-ink/50">
            見込み {EXPECTED_RANGE.from}〜{EXPECTED_RANGE.to}%
          </span>
          <span>100%</span>
        </div>
      </div>

      <div className="mt-7 space-y-2 border-t border-nicchyo-ink/[0.07] pt-6 text-[13px] leading-[1.95] text-nicchyo-ink/55">
        <p>
          運営費のほとんどは、使う方の数によらず {formatJpy(monthlyCostJpy)}
          のままです。使ってくださる方が増えるほど、おひとりあたりは軽くなります。
        </p>
        <p className="text-nicchyo-ink/45">
          日曜市の来場者は1回およそ{VISITORS_PER_MARKET_DAY.toLocaleString("ja-JP")}
          人（高知市調べ）。日曜が{MARKET_DAYS_PER_MONTH}回ある月で、のべ
          {MONTHLY_MARKET_VISITORS.toLocaleString("ja-JP")}人として計算しております。
          {actualMonthlyVisitors !== null &&
            `今月はこれまでに ${actualMonthlyVisitors.toLocaleString("ja-JP")}人にご利用いただいております。`}
        </p>
      </div>
    </div>
  );
}
