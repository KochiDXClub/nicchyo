/**
 * 1年ぶんのサーバー代のうち、支援でまかなえている月数を出すメーター
 *
 * このページで唯一の図。必要額（12ヶ月ぶんの目盛り全体）と、集まっている額
 * （塗られたぶん）を1つの図で同時に見せるため、棒グラフを2本並べる形は取らない。
 *
 * 目盛りは月。連続したバーだと「◯円集まった」までしか伝わらないが、
 * 月で刻むと「あと何ヶ月動かせるか」がそのまま読める。
 *
 * 色は塗りと下地で同じ緑の濃淡にしている（メーターは状態を1色の濃淡で表すもので、
 * 塗りと下地に別の色相を当てると、下地の側にも意味があるように見えてしまう）。
 */

type RunwayMeterProps = {
  /** 支援でまかなえている月数。端数はその月のセルを部分的に塗る */
  months: number;
  /** 目盛りの総月数 */
  totalMonths: number;
};

export default function RunwayMeter({ months, totalMonths }: RunwayMeterProps) {
  const covered = Math.max(0, Math.min(months, totalMonths));

  return (
    <div
      role="img"
      aria-label={`1年ぶんのサーバー代のうち、支援でまかなえているのは ${covered.toFixed(1)} ヶ月ぶん`}
    >
      <div className="flex gap-[2px]">
        {Array.from({ length: totalMonths }, (_, index) => {
          // このセルが何割塗られるか。0〜1 に丸めるので、端数の月だけ途中まで塗られる
          const fill = Math.max(0, Math.min(covered - index, 1));
          return (
            <div
              key={index}
              className="h-11 flex-1 overflow-hidden rounded-[3px] bg-[#E3EFDC]"
            >
              <div
                className="h-full bg-[#15803D]"
                style={{ width: `${fill * 100}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* 目盛り。両端だけ書く。全部の月に数字を振ると図が読みにくくなる */}
      <div className="mt-2 flex justify-between text-[11px] tabular-nums text-nicchyo-ink/40">
        <span>1ヶ月</span>
        <span>{totalMonths}ヶ月</span>
      </div>
    </div>
  );
}
