import {
  USD_JPY,
  formatJpy,
  formatUsd,
  monthlyJpyOf,
  type RunningCost,
} from "../costs";

/**
 * 費目の台帳
 *
 * 金額だけを並べても「高いか安いか」しか伝わらないので、1行に「何に使っているか」と
 * 「止まると何ができなくなるか」を添える。図はメーターに任せ、ここは金額の桁を
 * そろえて読ませることだけをする。
 *
 * 主にする数字は月額（円）。円だけを出すと、ドル建ての請求まで固定額に見えるので、
 * 換算前の請求額（$20/月、7,000円/年）を必ず横に添える。レートと基準日は末尾に置く。
 */

type CostLedgerProps = {
  costs: RunningCost[];
  monthlyTotalJpy: number;
  annualTotalJpy: number;
  /** 未確定の費目が残っているか。残っていれば合計に「以上」を付ける */
  hasPending: boolean;
};

/** 換算前の請求額。月払いの円建てだけは、主の数字と同じなので出さない */
function sourceAmount(cost: RunningCost): string | null {
  if (cost.amount === null) return null;
  if (cost.currency === "USD") {
    return `${formatUsd(cost.amount)} / ${cost.cycle === "annual" ? "年" : "月"}`;
  }
  if (cost.cycle === "annual") return `年 ${formatJpy(cost.amount)}`;
  return null;
}

export default function CostLedger({
  costs,
  monthlyTotalJpy,
  annualTotalJpy,
  hasPending,
}: CostLedgerProps) {
  const usesUsd = costs.some((cost) => cost.currency === "USD" && cost.amount !== null);

  return (
    <div>
      <dl className="border-t border-nicchyo-ink/10">
        {costs.map((cost) => {
          const monthly = monthlyJpyOf(cost);
          const source = sourceAmount(cost);
          return (
            <div
              key={cost.label}
              className="flex items-baseline justify-between gap-6 border-b border-nicchyo-ink/[0.07] py-4"
            >
              <dt className="min-w-0">
                <span className="block text-[15px] font-bold">{cost.label}</span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-nicchyo-ink/45">
                  {cost.purpose}
                  <span className="mx-1.5 text-nicchyo-ink/25">/</span>
                  {cost.stopsWhat}
                </span>
              </dt>
              <dd className="shrink-0 text-right">
                {monthly === null ? (
                  <span className="text-[14px] text-nicchyo-ink/30">調整中</span>
                ) : (
                  <>
                    <span className="block text-[15px] font-bold tabular-nums">
                      {formatJpy(monthly)}
                    </span>
                    {source && (
                      <span className="mt-0.5 block text-[11.5px] tabular-nums text-nicchyo-ink/40">
                        {source}
                      </span>
                    )}
                  </>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <div className="flex items-baseline justify-between gap-6 pt-5">
        <span className="text-[12.5px] text-nicchyo-ink/50">合計</span>
        <span className="text-right">
          <span className="block text-[1.7rem] font-bold leading-none tabular-nums">
            {formatJpy(monthlyTotalJpy)}
            {hasPending && <span className="ml-1 text-[15px] text-nicchyo-ink/40">以上</span>}
          </span>
          <span className="mt-1.5 block text-[12.5px] tabular-nums text-nicchyo-ink/45">
            年 {formatJpy(annualTotalJpy)}
            {hasPending && "以上"}
          </span>
        </span>
      </div>

      {usesUsd && (
        <p className="mt-5 text-[12px] leading-relaxed text-nicchyo-ink/40">
          ドル建ての請求は 1ドル {USD_JPY.rate.toFixed(2)}円（
          {new Date(USD_JPY.asOf).toLocaleDateString("ja-JP", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          時点）で換算しております。為替により、実際にお支払いする額は毎月変わります。
        </p>
      )}
    </div>
  );
}
