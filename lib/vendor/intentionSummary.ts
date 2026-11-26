/**
 * 出店意向調査の集計（純粋関数）。市役所に見せるのは、ここで作った場所ごとの件数だけ。
 *
 * 少数の回答から個人の店が分かるのを防ぐため、件数が MIN_REPORTABLE 未満のものは伏せる（null）。
 *   - 回答者全体が MIN_REPORTABLE 未満なら、回答者数も含めてすべて伏せる
 *   - 伏せた場所があれば、表示中のいちばん小さい場所も伏せる（伏せた場所の合計を残りの合計から逆算させないため）
 *   - 0 件は伏せない（何も分からないため）
 */
import type { IntentionPlace } from "./intention";

export const INTENTION_MIN_REPORTABLE = 3;

export type IntentionPlaceCell = {
  placeId: string;
  storeNumber: number;
  name: string | null;
  /** 件数。伏せるときは null */
  count: number | null;
};

export type IntentionSummary = {
  /** 回答者数。伏せるときは null */
  respondents: number | null;
  /** 区画番号の昇順 */
  places: IntentionPlaceCell[];
  minReportable: number;
};

export type IntentionSummaryRow = {
  place_id: string;
};

function isReportable(count: number): boolean {
  return count === 0 || count >= INTENTION_MIN_REPORTABLE;
}

/** 回答の一覧から、市役所に見せる場所ごとの件数を作る。店舗ごとの情報は返さない */
export function summariseIntentions(rows: IntentionSummaryRow[], places: IntentionPlace[]): IntentionSummary {
  const respondentCount = rows.length;

  if (respondentCount < INTENTION_MIN_REPORTABLE) {
    return {
      respondents: null,
      places: places.map((place) => ({ placeId: place.id, storeNumber: place.storeNumber, name: place.name, count: null })),
      minReportable: INTENTION_MIN_REPORTABLE,
    };
  }

  const tally = new Map<string, number>();
  for (const row of rows) tally.set(row.place_id, (tally.get(row.place_id) ?? 0) + 1);

  const counts = places.map((place) => ({ place, count: tally.get(place.id) ?? 0 }));
  const hide = new Set<string>(counts.filter((c) => !isReportable(c.count)).map((c) => c.place.id));
  if (hide.size >= 1) {
    const candidates = counts.filter((c) => !hide.has(c.place.id) && c.count > 0);
    if (candidates.length > 0) {
      hide.add(candidates.reduce((a, b) => (b.count < a.count ? b : a)).place.id);
    }
  }

  return {
    respondents: respondentCount,
    places: counts.map(({ place, count }) => ({
      placeId: place.id,
      storeNumber: place.storeNumber,
      name: place.name,
      count: hide.has(place.id) ? null : count,
    })),
    minReportable: INTENTION_MIN_REPORTABLE,
  };
}
