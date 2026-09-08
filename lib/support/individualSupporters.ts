/**
 * 個人でご支援くださった方
 *
 * 企業の協賛枠（lib/support/supporters.ts）とは分けて持つ。
 * 個人のご支援にロゴ枠を割り当てると、金額の大小がそのまま見た目の差になって
 * しまう。個人はお名前を並べるだけにして、順番も金額ではなく時系列にする。
 *
 * 掲載はご本人の同意があるときだけ。同意をいただけていない方はこの配列に
 * 入れず、ANONYMOUS_SUPPORTER_COUNT の方で数える。
 * 金額はこちらには持たない（誰がいくら出したかが並ぶ形にしない）。
 *
 * ── 掲載の期間について ────────────────────────────────────────────
 * 一度ご支援いただいたお名前は、期限を切らずに掲載し続ける。
 *
 * 企業のご協賛は「1年間の掲載と、その間のお返し」という取り決めだが、個人の
 * ご支援は見返りのない贈り物なので、期限を切ると性質が変わってしまう。
 * 積み上がっていくことそのものが、このページの意味になる。
 *
 * 運用の面でも、期限管理・更新のお願い・掲載終了の判断がいらない形にしておく。
 * 部員が入れ替わっても、追記するだけで続けられる。
 *
 * ★ ただし「ずっと掲載する」は「取り下げられない」ではない。
 *   公開しているのはご本人の同意にもとづく個人情報なので、削除のご希望が
 *   あればいつでも配列から消すこと。何年前の分でも同じ。
 *
 * 同じ方から複数回いただいた場合も、行は増やさず1つにまとめる（since は
 * 最初にいただいた月のまま）。回数の多さが並びに出る形にしない。
 */

export type IndividualSupporter = {
  /** 掲載するお名前。ニックネームやハンドルネームでも構わない */
  name: string;
  /** ご支援いただいた年月（YYYY-MM）。並びと「いつから」の表示に使う */
  since: string;
  /** ご本人からいただいたひとこと。任意 */
  message?: string;
};

/** 掲載の同意をいただいた方。新しい順に並べ替えて出す */
export const INDIVIDUAL_SUPPORTERS: IndividualSupporter[] = [];

/**
 * お名前の掲載を希望されなかった方の人数。
 * 名前は持たず、人数だけを「ほか◯名」として出す。
 */
export const ANONYMOUS_SUPPORTER_COUNT = 0;

/** 新しい順。同じ月なら配列の順を保つ */
export function sortedIndividualSupporters(
  supporters: IndividualSupporter[] = INDIVIDUAL_SUPPORTERS
): IndividualSupporter[] {
  return [...supporters].sort((a, b) => b.since.localeCompare(a.since));
}

/** 掲載しているお名前と、匿名の方を合わせた人数 */
export function totalIndividualSupporters(
  supporters: IndividualSupporter[] = INDIVIDUAL_SUPPORTERS,
  anonymousCount: number = ANONYMOUS_SUPPORTER_COUNT
): number {
  return supporters.length + anonymousCount;
}

export type SupporterYearGroup = {
  /** "2026" */
  year: string;
  supporters: IndividualSupporter[];
};

/**
 * 年ごとにまとめる。新しい年が先。
 *
 * 期限を切らずに積み上げていくので、いずれ一続きの並びでは読めなくなる。
 * 年で区切っておくと、増えるほど「続いてきた長さ」が見える形になる。
 */
export function groupSupportersByYear(
  supporters: IndividualSupporter[] = INDIVIDUAL_SUPPORTERS
): SupporterYearGroup[] {
  const groups: SupporterYearGroup[] = [];
  for (const supporter of sortedIndividualSupporters(supporters)) {
    const year = supporter.since.slice(0, 4);
    const last = groups[groups.length - 1];
    if (last && last.year === year) {
      last.supporters.push(supporter);
    } else {
      groups.push({ year, supporters: [supporter] });
    }
  }
  return groups;
}

/** "2026-09" → "9月"。年は見出しに出ているので、行では月だけ出す */
export function formatMonth(since: string): string {
  const match = since.match(/^\d{4}-(\d{2})$/);
  return match ? `${Number(match[1])}月` : "";
}

/** "2026-09" → "2026年9月"。読めない形ならそのまま返す */
export function formatSince(since: string): string {
  const match = since.match(/^(\d{4})-(\d{2})$/);
  if (!match) return since;
  return `${match[1]}年${Number(match[2])}月`;
}
