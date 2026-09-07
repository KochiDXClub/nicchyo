/**
 * 運営費ページに出す数字
 *
 * 実費なので、請求が変わったらここを書き換えて1回デプロイする。DBには持たない。
 * 年に数回しか変わらない値のために管理画面を作っても、使われずに古くなるだけ。
 *
 * ここに書く数字は必ず実際の請求額にすること。運営費ページは「学生が
 * ちゃんと計測している」ことを見せるためのページなので、概算や見込みを
 * 実費として出すと、ページの目的そのものが壊れる。
 * わからないうちは null にしておけば「調整中」と出る。
 */

export type RunningCost = {
  /** 費目名 */
  label: string;
  /** 何に使っているか。1行で */
  purpose: string;
  /** 月額（円）。まだ確定していなければ null */
  monthlyJpy: number | null;
};

/**
 * 月々かかっているもの。
 *
 * TODO ではなく運用の手順として: 請求額が判明したら monthlyJpy を埋める。
 * 全部 null のあいだ、ページは内訳の代わりに年額の目安だけを出す。
 */
export const RUNNING_COSTS: RunningCost[] = [
  { label: "Vercel", purpose: "サイトの配信", monthlyJpy: null },
  { label: "Supabase", purpose: "店舗データとログインの保管", monthlyJpy: null },
  { label: "OpenAI API", purpose: "にちよさんの相談とマップ案内", monthlyJpy: null },
  { label: "ドメイン", purpose: "nicchyo.jp の維持", monthlyJpy: null },
];

/** 年間でかかる額の目安。内訳が埋まるまではこちらを出す */
export const ANNUAL_COST_RANGE_JPY = { min: 150_000, max: 200_000 };

/** これまでの評価。協賛や助成を検討する人が最初に見るところ */
export const TRACK_RECORD = [
  { label: "こうちNPOアワード2025", value: "ワカモノ未来賞" },
  { label: "高知市商業振興課", value: "公式連携" },
];

/**
 * 協賛でお願いしていること。
 *
 * 金額と掲載場所を書いていないページに問い合わせは来ないので、
 * 決まったら必ず埋める。決まっていないうちは null にしておくと、
 * 「相談しながら決める」という出し方になる。
 */
export const SPONSOR_PLAN: {
  /** 1口あたりの年額（円）。未定なら null */
  unitAnnualJpy: number | null;
  /** 掲載される場所 */
  places: string[];
  /** 掲載期間 */
  term: string;
} = {
  unitAnnualJpy: null,
  places: ["この運営費ページ", "nicchyoとは のページ"],
  term: "1年間（年度単位で更新）",
};

/** 掲載する協賛・支援者。空のあいだは一覧そのものを出さない */
export const SUPPORTERS: { name: string; note?: string }[] = [];

export function formatJpy(value: number): string {
  return `${value.toLocaleString("ja-JP")}円`;
}

/** 内訳がひとつでも埋まっていれば、内訳を出す */
export function hasCostBreakdown(costs: RunningCost[] = RUNNING_COSTS): boolean {
  return costs.some((cost) => cost.monthlyJpy !== null);
}

/** 埋まっているぶんだけ合計する。全部 null なら null */
export function sumMonthlyJpy(costs: RunningCost[] = RUNNING_COSTS): number | null {
  const known = costs.filter((cost) => cost.monthlyJpy !== null);
  if (known.length === 0) return null;
  return known.reduce((sum, cost) => sum + (cost.monthlyJpy ?? 0), 0);
}
