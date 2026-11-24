/**
 * 出店意向調査の集計（純粋関数）。市役所に見せるのは、ここで作った件数だけ。
 *
 * 少数の回答から個人の店が分かるのを防ぐため、件数が MIN_REPORTABLE 未満のものは伏せる（null）。
 *   - 回答者全体が MIN_REPORTABLE 未満なら、回答者数も含めてすべて伏せる
 *   - 区画数・頻度のように合計が回答者数になる項目では、伏せた1つを合計から逆算されないよう、
 *     もう1つ（いちばん小さい項目）も伏せる（相補的な伏せ）
 *   - 0 件は伏せない（何も分からないため）
 */
import {
  INTENTION_BOOTH_COUNTS,
  INTENTION_FREQUENCIES,
  type IntentionBoothCount,
  type IntentionFrequency,
} from "./intention";

export const INTENTION_MIN_REPORTABLE = 3;

export type IntentionCell<K> = {
  key: K;
  /** 件数。伏せるときは null */
  count: number | null;
};

export type IntentionSummary = {
  /** 回答者数。伏せるときは null */
  respondents: number | null;
  boothCounts: IntentionCell<IntentionBoothCount>[];
  frequencies: IntentionCell<IntentionFrequency>[];
  /** 出られたい月ごとの件数（1 人が複数の月を選べる） */
  months: IntentionCell<number>[];
  minReportable: number;
};

export type IntentionSummaryRow = {
  booth_count: number;
  frequency: string;
  preferred_months: number[] | null;
};

function isReportable(count: number): boolean {
  return count === 0 || count >= INTENTION_MIN_REPORTABLE;
}

/** 合計が回答者数になる項目を作る。伏せた項目が1つだけなら、いちばん小さい項目も伏せる */
function exclusiveCells<K>(keys: readonly K[], tally: Map<K, number>): IntentionCell<K>[] {
  const counts = keys.map((key) => ({ key, count: tally.get(key) ?? 0 }));
  const hide = new Set<K>(counts.filter((c) => !isReportable(c.count)).map((c) => c.key));
  if (hide.size === 1) {
    const candidates = counts.filter((c) => !hide.has(c.key) && c.count > 0);
    if (candidates.length > 0) {
      hide.add(candidates.reduce((a, b) => (b.count < a.count ? b : a)).key);
    }
  }
  return counts.map((c) => ({ key: c.key, count: hide.has(c.key) ? null : c.count }));
}

/** 回答の一覧から、市役所に見せる集計を作る。店舗ごとの情報は返さない */
export function summariseIntentions(rows: IntentionSummaryRow[]): IntentionSummary {
  const respondentCount = rows.length;
  const boothTally = new Map<IntentionBoothCount, number>();
  const frequencyTally = new Map<IntentionFrequency, number>();
  const monthTally = new Map<number, number>();

  for (const row of rows) {
    const booth = row.booth_count as IntentionBoothCount;
    const frequency = row.frequency as IntentionFrequency;
    boothTally.set(booth, (boothTally.get(booth) ?? 0) + 1);
    frequencyTally.set(frequency, (frequencyTally.get(frequency) ?? 0) + 1);
    for (const month of new Set(row.preferred_months ?? [])) {
      monthTally.set(month, (monthTally.get(month) ?? 0) + 1);
    }
  }

  const hideAll = respondentCount < INTENTION_MIN_REPORTABLE;
  const hiddenCell = <K>(key: K): IntentionCell<K> => ({ key, count: null });
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  if (hideAll) {
    return {
      respondents: null,
      boothCounts: INTENTION_BOOTH_COUNTS.map(hiddenCell),
      frequencies: INTENTION_FREQUENCIES.map(hiddenCell),
      months: months.map(hiddenCell),
      minReportable: INTENTION_MIN_REPORTABLE,
    };
  }

  return {
    respondents: respondentCount,
    boothCounts: exclusiveCells([...INTENTION_BOOTH_COUNTS], boothTally),
    frequencies: exclusiveCells([...INTENTION_FREQUENCIES], frequencyTally),
    months: months.map((month) => {
      const count = monthTally.get(month) ?? 0;
      return { key: month, count: isReportable(count) ? count : null };
    }),
    minReportable: INTENTION_MIN_REPORTABLE,
  };
}
