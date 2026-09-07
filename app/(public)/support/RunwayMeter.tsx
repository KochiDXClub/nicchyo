/**
 * 1年ぶんのサーバー代のうち、支援でまかなえている月数を出すメーター
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
 */

import type { FundingSegment } from "@/lib/support/supporters";

type RunwayMeterProps = {
  /** 塗り。入っている順に左から積む */
  segments: FundingSegment[];
  /** 目盛りの総月数 */
  totalMonths: number;
};

export default function RunwayMeter({ segments, totalMonths }: RunwayMeterProps) {
  // 各区間の開始・終了を月単位で持つ。目盛りをはみ出したぶんは切る
  let cursor = 0;
  const spans = segments.map((segment) => {
    const start = cursor;
    cursor = Math.min(cursor + segment.months, totalMonths);
    return { ...segment, start, end: cursor };
  });
  const covered = cursor;

  return (
    <div
      role="img"
      aria-label={`1年ぶんのサーバー代のうち、支援でまかなえているのは ${covered.toFixed(1)} ヶ月ぶん`}
    >
      <div className="flex gap-[2px]">
        {Array.from({ length: totalMonths }, (_, month) => (
          <div
            key={month}
            className="relative h-11 flex-1 overflow-hidden rounded-[3px] bg-nicchyo-ink/[0.07]"
          >
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
          </div>
        ))}
      </div>

      {/* 目盛り。両端だけ書く。全部の月に数字を振ると図が読みにくくなる */}
      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-nicchyo-ink/40">
        <span>1ヶ月</span>
        <span>{totalMonths}ヶ月</span>
      </div>
    </div>
  );
}
