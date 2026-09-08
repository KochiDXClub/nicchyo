/**
 * 運営費ページに出す数字
 *
 * 実費なので、請求が変わったらここを書き換えて1回デプロイする。DBには持たない。
 * 年に数回しか変わらない値のために管理画面を作っても、使われずに古くなるだけ。
 *
 * ここに書く数字は必ず実額にすること。このページは「学生がちゃんと計測している」
 * ことを見せるためにあるので、概算を実費として出すと目的そのものが壊れる。
 * わからないうちは null にしておけば、ページ側がその前提で表示を変える。
 */

/** 1年ぶんの運営費を、何ヶ月ぶん賄えているかで見せる */
export const RUNWAY_MONTHS = 12;

/** 請求の周期。年払いのものは月額に割って並べる */
export type BillingCycle = "monthly" | "annual";

export type RunningCost = {
  label: string;
  /** 何に使っているか。短く */
  purpose: string;
  /**
   * この費目が止まると何ができなくなるか。短く。
   * 金額だけを並べても「高いか安いか」しか伝わらないため、対価を1行で添える
   */
  stopsWhat: string;
  /** 請求額（円）。まだ確定していなければ null */
  amountJpy: number | null;
  cycle: BillingCycle;
};

/** 月々かかっているもの。請求額が変わったら書き換える */
export const RUNNING_COSTS: RunningCost[] = [
  {
    label: "Vercel",
    purpose: "サイトの配信",
    stopsWhat: "止まればサイトが開きません",
    amountJpy: 3_000,
    cycle: "monthly",
  },
  {
    label: "Supabase",
    purpose: "店舗データとログイン",
    stopsWhat: "止まれば店舗の情報を引けません",
    amountJpy: 3_000,
    cycle: "monthly",
  },
  {
    label: "OpenAI API",
    purpose: "にちよさんの相談",
    stopsWhat: "止まれば相談だけが使えません",
    amountJpy: 1_000,
    cycle: "monthly",
  },
  {
    label: "ドメイン",
    purpose: "nicchyo.jp の維持",
    stopsWhat: "止まれば配布済みのQRコードが開きません",
    amountJpy: 7_000,
    cycle: "annual",
  },
];

/**
 * いま支援でお預かりしている額。
 * 協賛や寄付が決まるたびに書き換える。0 のあいだは全額を学生が負担している。
 */
export const FUNDS_ON_HAND_JPY = 0;

/** 協賛1口の年額。決まったら埋める（何ヶ月ぶんにあたるかはページ側が計算する） */
export const SPONSOR_UNIT_ANNUAL_JPY: number | null = null;

export function formatJpy(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

/** 費目の月額換算。年払いのものは12で割る。未確定なら null */
export function monthlyOf(cost: RunningCost): number | null {
  if (cost.amountJpy === null) return null;
  return cost.cycle === "annual" ? cost.amountJpy / 12 : cost.amountJpy;
}

/**
 * 金額が未確定の費目があるか。
 *
 * 未確定のぶんは合計に入らないので、合計は実際より少なく出る。少なく見せると
 * 「あと何ヶ月動くか」が長く出てこのページの信用が落ちるため、1つでも残って
 * いるあいだは合計を「◯◯円以上」として出す（表示の判断はページ側）。
 */
export function hasPendingCost(costs: RunningCost[] = RUNNING_COSTS): boolean {
  return costs.some((cost) => cost.amountJpy === null);
}

/** 1ヶ月にかかる額。未確定の費目は 0 として足す */
export function monthlyCostJpy(costs: RunningCost[] = RUNNING_COSTS): number {
  return costs.reduce((sum, cost) => sum + (monthlyOf(cost) ?? 0), 0);
}

/** 1年にかかる額 */
export function annualCostJpy(costs: RunningCost[] = RUNNING_COSTS): number {
  return monthlyCostJpy(costs) * 12;
}

/** 手元の額で何ヶ月動かせるか */
export function runwayMonths(
  fundsJpy: number = FUNDS_ON_HAND_JPY,
  monthly: number = monthlyCostJpy()
): number {
  if (monthly <= 0) return 0;
  return fundsJpy / monthly;
}

/** 協賛1口が何ヶ月ぶんにあたるか。金額未定なら null */
export function sponsorUnitMonths(
  unitAnnualJpy: number | null = SPONSOR_UNIT_ANNUAL_JPY,
  monthly: number = monthlyCostJpy()
): number | null {
  if (unitAnnualJpy === null || monthly <= 0) return null;
  return unitAnnualJpy / monthly;
}
