"use client";

import { useId, useState } from "react";
import { costPerVisitorJpy, formatJpy, formatPerVisitorJpy } from "../costs";

/**
 * 「何人が使った場合、ひとりあたりいくらか」
 *
 * 10,047円 という月額は、それだけ見ても高いのか安いのか判断できない。
 * 人数で割ると初めて比べられる数になる。
 *
 * この割り算が意味を持つのは、費目がほぼ全部固定費だから。人が増えても月額は
 * ほとんど動かないので、「使われるほど軽くなる」がそのまま成り立つ。
 * 変動するのは OpenAI の従量分だけで、月額に対しては誤差の範囲になる。
 *
 * 人のかたちは常に上限ぶん並べておき、届いた数までを色で塗る。増減で並びが
 * 動くと、つまみを操作するたびに図が跳ねて読めなくなる。塗られていないぶんは
 * 「まだ届いていない人」として残す（RunwayMeter の空きマスと同じ考え方）。
 */

/** 人のかたち1つが表す人数。図の目盛りなので、変えたら画面の但し書きも直す */
const PEOPLE_PER_FIGURE = 200;
/** 並べるかたちの数。PEOPLE_PER_FIGURE と掛けたものがつまみの上限になる */
const FIGURE_COUNT = 100;

const MIN_VISITORS = 1_000;
const MAX_VISITORS = PEOPLE_PER_FIGURE * FIGURE_COUNT;
const STEP = 500;

/** つまみの初期位置。実績が無いときはここから始める */
const DEFAULT_VISITORS = 3_000;

/** 高知市の公表値。図の目盛りが現実のどのあたりかを示すために置く */
const SUNDAY_MARKET_VISITORS_PER_DAY = 17_000;

type CostPerVisitorProps = {
  /** 1ヶ月の運営費（円） */
  monthlyCostJpy: number;
  /** 今月これまでの実績。取れていれば初期位置に使う */
  actualMonthlyVisitors: number | null;
};

function clampToRange(value: number): number {
  return Math.min(Math.max(value, MIN_VISITORS), MAX_VISITORS);
}

/** 人のかたち。頭と肩だけの単純な形にして、100個並べても潰れないようにする */
function PersonGlyph({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 12 24" fill="currentColor" aria-hidden className={className}>
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
  const [visitors, setVisitors] = useState(() =>
    clampToRange(actualMonthlyVisitors && actualMonthlyVisitors > 0
      ? actualMonthlyVisitors
      : DEFAULT_VISITORS)
  );

  const perVisitor = costPerVisitorJpy(monthlyCostJpy, visitors);
  const filledFigures = Math.min(Math.ceil(visitors / PEOPLE_PER_FIGURE), FIGURE_COUNT);
  const visitorsLabel = visitors.toLocaleString("ja-JP");

  return (
    <div>
      <p className="text-[14px] leading-[1.9] text-nicchyo-ink/55">
        毎月 <strong className="font-bold tabular-nums text-nicchyo-ink">{visitorsLabel}人</strong>{" "}
        に使っていただいた場合、
      </p>

      {/* このかたまりの主役。ページの中でいちばん大きい数字にする */}
      <p className="mt-3 flex items-baseline gap-2.5">
        <span className="text-[3.25rem] font-bold leading-none tabular-nums sm:text-[4rem]">
          {perVisitor === null ? "—" : formatPerVisitorJpy(perVisitor)}
        </span>
        <span className="text-[14px] font-bold text-nicchyo-ink/45">おひとり / 1ヶ月</span>
      </p>

      {/* 群衆。届いた数までを塗り、残りは薄いまま置いておく */}
      <div
        role="img"
        aria-label={`${visitorsLabel}人を、ひとかたち ${PEOPLE_PER_FIGURE}人として並べた図。${FIGURE_COUNT}かたちのうち ${filledFigures} かたちが色づいています`}
        // 列数は FIGURE_COUNT を割り切れる数だけにする。auto-fill に任せると
        // 最後の行だけ数個で終わり、意図した形に見えない
        className="mt-9 grid grid-cols-[repeat(10,minmax(0,1fr))] gap-y-2.5 sm:grid-cols-[repeat(20,minmax(0,1fr))] lg:grid-cols-[repeat(25,minmax(0,1fr))]"
      >
        {Array.from({ length: FIGURE_COUNT }, (_, index) => (
          <span key={index} className="flex justify-center">
            <PersonGlyph
              className={`h-5 w-auto transition-colors duration-500 motion-reduce:transition-none sm:h-6 ${
                // 届いていないぶんは、地に沈むくらいまで薄くする。濃いと
                // 「もう一つの群衆」に見えて、塗られたぶんの意味が薄れる
                index < filledFigures ? "text-[#D97706]" : "text-nicchyo-ink/[0.06]"
              }`}
              // 端から順に色が回るくらいの、ごく短い遅れ。動きはここだけ
              // （style は motion-reduce では transition ごと切れるので効かない）
            />
          </span>
        ))}
      </div>

      <p className="mt-4 text-[11.5px] text-nicchyo-ink/40">
        ひとかたち = {PEOPLE_PER_FIGURE}人
      </p>

      {/* つまみ。人数を動かすと上の数字と図が同時に変わる */}
      <div className="mt-8">
        <label htmlFor={sliderId} className="sr-only">
          1ヶ月に使ってくださる人の数
        </label>
        <input
          id={sliderId}
          type="range"
          min={MIN_VISITORS}
          max={MAX_VISITORS}
          step={STEP}
          value={visitors}
          onChange={(event) => setVisitors(Number(event.target.value))}
          aria-valuetext={`${visitorsLabel}人`}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-nicchyo-ink/10 accent-[#D97706]"
          style={{ accentColor: "#D97706" }}
        />
        <div className="mt-2 flex justify-between text-[11.5px] tabular-nums text-nicchyo-ink/40">
          <span>{MIN_VISITORS.toLocaleString("ja-JP")}人</span>
          <span>{MAX_VISITORS.toLocaleString("ja-JP")}人</span>
        </div>
      </div>

      <div className="mt-7 space-y-2 border-t border-nicchyo-ink/[0.07] pt-6 text-[13px] leading-[1.95] text-nicchyo-ink/55">
        <p>
          運営費のほとんどは、使う方の数によらず {formatJpy(monthlyCostJpy)}
          のままです。使ってくださる方が増えるほど、おひとりあたりは軽くなります。
        </p>
        <p className="text-nicchyo-ink/45">
          日曜市には、1日およそ{SUNDAY_MARKET_VISITORS_PER_DAY.toLocaleString("ja-JP")}
          人が訪れます（高知市調べ）。
          {actualMonthlyVisitors !== null &&
            `今月はこれまでに ${actualMonthlyVisitors.toLocaleString("ja-JP")}人にご利用いただいております。`}
        </p>
      </div>
    </div>
  );
}
