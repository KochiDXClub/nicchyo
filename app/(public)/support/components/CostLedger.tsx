import { formatJpy, monthlyOf, type RunningCost } from "../costs";

/**
 * 費目の台帳
 *
 * 金額だけを並べても「高いか安いか」しか伝わらないので、1行に「何に使っているか」と
 * 「止まると何ができなくなるか」を添える。図はメーターに任せ、ここは金額の桁を
 * そろえて読ませることだけをする。
 *
 * 年払いのものは月額に割った額を主にして、元の請求額を横に添える。月額だけだと
 * 実際の請求と突き合わせられず、年額だけだと他の費目と比べられない。
 */

type CostLedgerProps = {
  costs: RunningCost[];
  monthlyTotalJpy: number;
  annualTotalJpy: number;
  /** 未確定の費目が残っているか。残っていれば合計に「以上」を付ける */
  hasPending: boolean;
};

export default function CostLedger({
  costs,
  monthlyTotalJpy,
  annualTotalJpy,
  hasPending,
}: CostLedgerProps) {
  return (
    <div>
      <dl className="border-t border-nicchyo-ink/10">
        {costs.map((cost) => {
          const monthly = monthlyOf(cost);
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
                    {cost.cycle === "annual" && cost.amountJpy !== null && (
                      <span className="mt-0.5 block text-[11.5px] tabular-nums text-nicchyo-ink/40">
                        年 {formatJpy(cost.amountJpy)}
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
    </div>
  );
}
