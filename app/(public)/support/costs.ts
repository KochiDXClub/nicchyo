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

/**
 * 為替
 *
 * Vercel・Supabase・OpenAI の請求はドル建てなので、円で出している額は換算値でしかない。
 * 「3,000円」のような丸めた円を実費として出すと、為替が動いたときに嘘になるうえ、
 * 元がドルであることも隠れる。レートと基準日を持って、画面にも並べて出す。
 *
 * 月初に一度見て書き換える。1円の変動で、この規模なら年 600円ほど動く。
 */
export const USD_JPY = {
  rate: 154.36,
  /** このレートを見た日 */
  asOf: "2026-09-07",
} as const;

/** 請求通貨。円建ては国内で買っているものだけ */
export type Currency = "USD" | "JPY";

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
  /** 請求額。currency の通貨で書く。まだ確定していなければ null */
  amount: number | null;
  currency: Currency;
  cycle: BillingCycle;
};

/** 月々かかっているもの。請求額が変わったら書き換える */
export const RUNNING_COSTS: RunningCost[] = [
  {
    label: "Vercel",
    purpose: "サイトの配信",
    stopsWhat: "止まればサイトが開きません",
    // Pro プランは開発者1人あたり $20。人数を増やすとそのぶん増える
    amount: 20,
    currency: "USD",
    cycle: "monthly",
  },
  {
    label: "Supabase",
    purpose: "店舗データとログイン",
    stopsWhat: "止まれば店舗の情報を引けません",
    // Pro プラン $25（最小のデータベース1台ぶんの費用を含む）
    amount: 25,
    currency: "USD",
    cycle: "monthly",
  },
  {
    label: "Supabase（開発用）",
    purpose: "本番に触らず試すための複製",
    stopsWhat: "止まれば本番のデータで試すことになります",
    // develop 用の永続ブランチ。$0.01344/時 なので月 730 時間で $9.81。
    // Pro に付く $10 のコンピュートクレジットは本番ぶんで使い切っていて、
    // ブランチには回らないため、まるごと上乗せになる
    amount: 9.81,
    currency: "USD",
    cycle: "monthly",
  },
  {
    label: "OpenAI API",
    purpose: "にちよさんの相談",
    stopsWhat: "止まれば相談だけが使えません",
    // 使った分だけの従量課金。毎月ダッシュボードの実績で書き換える
    amount: 6.5,
    currency: "USD",
    cycle: "monthly",
  },
  {
    label: "ドメイン",
    purpose: "nicchyo.jp の維持",
    stopsWhat: "止まれば配布済みのQRコードが開きません",
    amount: 7_000,
    currency: "JPY",
    cycle: "annual",
  },
];

/**
 * いま運営のためにお預かりしている額。
 *
 * 協賛・寄付・助成金のほか、賞金のうち運営費に充てるぶんもここに入れる。
 * 決まるたびに書き換える。
 *
 * 0 は「継続してお預かりしている額が無い」という意味であって、
 * 「これまで全額を学生が負担してきた」という意味ではない。賞金でも賄っている。
 */
export const FUNDS_ON_HAND_JPY = 0;

/**
 * これまでにご支援いただいた総額。
 *
 * FUNDS_ON_HAND_JPY（いまお預かりしている額）とは別物。こちらは累計なので
 * 減らない。使ったぶんは手元から減るが、いただいた事実は残る。
 * 必ず FUNDS_ON_HAND_JPY 以上になる（テストで見ている）。
 *
 * 協賛・寄付・助成金など、外からいただいたものを足す。賞金を含めるかは
 * 運営の判断で、含めるならページの文言にもその旨を書くこと。
 */
export const TOTAL_RECEIVED_JPY = 0;

/**
 * 協賛1口の年額。
 *
 * 「年額」であることが要。1口で運営費のおよそ3ヶ月分をまかなえる金額にしてあるが、
 * 掲載の期間は3ヶ月ではなく1年。金額の根拠（何ヶ月ぶんか）と、お返しする期間（1年）は
 * 別の話なので、画面では必ず分けて出すこと。混ぜると「3ヶ月しか載らない」と読まれる。
 *
 * 4口で1年ぶんに届く額にしている。口数は SUPPORTER_SLOT_COUNT と SUPPORTER_COLORS の
 * 色数に合わせてあるので、金額を変えるときはそちらも見直す。
 *
 * 年に一度見直す前提で置いている（そのことはページにも書いてある）。為替でも動くし、
 * 機能を足せば運営費が増える。ここを書き換えたら、既にご協賛くださっている方には
 * 次のご継続の相談のときにお伝えすること。黙って変えない。
 */
export const SPONSOR_UNIT_ANNUAL_JPY: number | null = 30_000;

export function formatJpy(value: number): string {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

/** ドル建ての請求額。表示に使う（円と並べて、換算前の額を見せる） */
export function formatUsd(value: number): string {
  // $20 は「$20」、$6.5 は「$6.50」。桁が揃わないと台帳として読みにくい
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

/** 請求額を円に直す。円建てはそのまま */
export function toJpy(amount: number, currency: Currency, rate: number = USD_JPY.rate): number {
  return currency === "USD" ? amount * rate : amount;
}

/** 費目の月額（円）。年払いのものは12で割る。未確定なら null */
export function monthlyJpyOf(cost: RunningCost, rate: number = USD_JPY.rate): number | null {
  if (cost.amount === null) return null;
  const jpy = toJpy(cost.amount, cost.currency, rate);
  return cost.cycle === "annual" ? jpy / 12 : jpy;
}

/**
 * 金額が未確定の費目があるか。
 *
 * 未確定のぶんは合計に入らないので、合計は実際より少なく出る。少なく見せると
 * 「あと何ヶ月動くか」が長く出てこのページの信用が落ちるため、1つでも残って
 * いるあいだは合計を「◯◯円以上」として出す（表示の判断はページ側）。
 */
export function hasPendingCost(costs: RunningCost[] = RUNNING_COSTS): boolean {
  return costs.some((cost) => cost.amount === null);
}

/** 1ヶ月にかかる額（円）。未確定の費目は 0 として足す */
export function monthlyCostJpy(
  costs: RunningCost[] = RUNNING_COSTS,
  rate: number = USD_JPY.rate
): number {
  return costs.reduce((sum, cost) => sum + (monthlyJpyOf(cost, rate) ?? 0), 0);
}

/** 1年にかかる額（円） */
export function annualCostJpy(
  costs: RunningCost[] = RUNNING_COSTS,
  rate: number = USD_JPY.rate
): number {
  return monthlyCostJpy(costs, rate) * 12;
}

/** 手元の額で何ヶ月動かせるか */
export function runwayMonths(
  fundsJpy: number = FUNDS_ON_HAND_JPY,
  monthly: number = monthlyCostJpy()
): number {
  if (monthly <= 0) return 0;
  return fundsJpy / monthly;
}

/**
 * 使ってくださった人ひとりあたり、1ヶ月にいくらかかっているか。
 *
 * このページの費目はほぼ全部が固定費で、人が増えても月額はほとんど動かない。
 * だから割り算がそのまま「使われるほど軽くなる」という話になる。
 * 人数が 0 のときは割れないので null を返す。
 */
export function costPerVisitorJpy(monthlyJpy: number, visitors: number): number | null {
  if (visitors <= 0 || monthlyJpy <= 0) return null;
  return monthlyJpy / visitors;
}

/** 1人あたりの額の書き方。1円を切ることがあるので小数第1位まで出す */
export function formatPerVisitorJpy(value: number): string {
  return `${value.toFixed(1)}円`;
}

/** 協賛1口が何ヶ月ぶんにあたるか。金額未定なら null */
export function sponsorUnitMonths(
  unitAnnualJpy: number | null = SPONSOR_UNIT_ANNUAL_JPY,
  monthly: number = monthlyCostJpy()
): number | null {
  if (unitAnnualJpy === null || monthly <= 0) return null;
  return unitAnnualJpy / monthly;
}
