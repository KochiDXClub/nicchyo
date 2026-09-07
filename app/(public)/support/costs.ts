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

/** 1年ぶんのサーバー代を、何ヶ月ぶん賄えているかで見せる */
export const RUNWAY_MONTHS = 12;

export type RunningCost = {
  label: string;
  /** 何に使っているか。1行で */
  purpose: string;
  /** 月額（円）。まだ確定していなければ null */
  monthlyJpy: number | null;
};

/** 月々かかっているもの。請求額が判明したら monthlyJpy を埋める */
export const RUNNING_COSTS: RunningCost[] = [
  { label: "Vercel", purpose: "サイトの配信", monthlyJpy: null },
  { label: "Supabase", purpose: "店舗データとログイン", monthlyJpy: null },
  { label: "OpenAI API", purpose: "にちよさんの相談", monthlyJpy: null },
  { label: "ドメイン", purpose: "nicchyo.jp の維持", monthlyJpy: null },
];

/** 内訳が埋まるまで使う、年額の見込み */
export const ANNUAL_COST_RANGE_JPY = { min: 150_000, max: 200_000 };

/**
 * いま支援でお預かりしている額。
 * 協賛や寄付が決まるたびに書き換える。0 のあいだは全額を学生が負担している。
 */
export const FUNDS_ON_HAND_JPY = 0;

/** 協賛1口の年額。決まったら埋める（何ヶ月ぶんにあたるかはページ側が計算する） */
export const SPONSOR_UNIT_ANNUAL_JPY: number | null = null;

/** これまでの評価。協賛や助成を検討する人が見るところ */
export const TRACK_RECORD = [
  { label: "こうちNPOアワード2025", value: "ワカモノ未来賞" },
  { label: "高知市商業振興課", value: "公式連携" },
];

export function formatJpy(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

/** 内訳がひとつでも埋まっていれば、内訳を出す */
export function hasCostBreakdown(costs: RunningCost[] = RUNNING_COSTS): boolean {
  return costs.some((cost) => cost.monthlyJpy !== null);
}

/**
 * 1ヶ月にかかる額。
 *
 * 内訳が埋まっていればその合計。まだなら年額の見込みの **上限** から出す。
 * 少なく見積もって「あと何ヶ月」を長く見せると、このページの信用が落ちるので、
 * わからないうちは多い方に倒す。
 */
export function monthlyCostJpy(costs: RunningCost[] = RUNNING_COSTS): number {
  const known = costs.filter((cost) => cost.monthlyJpy !== null);
  if (known.length > 0) {
    return known.reduce((sum, cost) => sum + (cost.monthlyJpy ?? 0), 0);
  }
  // 見込みからの割り算なので、100円単位に丸める。16,667円 のような桁まで出すと
  // 実測したように見えてしまう
  return Math.round(ANNUAL_COST_RANGE_JPY.max / 12 / 100) * 100;
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
