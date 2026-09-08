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

/** "2026-09" → "2026年9月"。読めない形ならそのまま返す */
export function formatSince(since: string): string {
  const match = since.match(/^(\d{4})-(\d{2})$/);
  if (!match) return since;
  return `${match[1]}年${Number(match[2])}月`;
}
