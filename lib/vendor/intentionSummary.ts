/**
 * 出店意向調査の集計（純粋関数）。市役所に見せるのは、丁目ごと・場所ごとの件数だけ。
 *
 * 少数の回答から個人の店が分かるのを防ぐため、件数が MIN_REPORTABLE 未満のものは伏せる（null）。
 *   - 回答者全体が MIN_REPORTABLE 未満なら、回答者数も含めてすべて伏せる
 *   - 伏せた項目があれば、表示中のいちばん小さい項目（0件より大きいもの）も伏せる（合計から逆算させないため）
 *   - 0 件は伏せない（何も分からないため）
 * 運営の管理画面は mask: false で、伏せずに件数を見る。
 */
import { CHOMES, type ChomeId } from "@/lib/map/chomes";
import type { IntentionPlace } from "./intention";

export const INTENTION_MIN_REPORTABLE = 3;

export type IntentionPlaceCell = {
  placeId: string;
  storeNumber: number;
  name: string | null;
  chome: ChomeId | null;
  /** 地図の点の位置（分からなければ null） */
  lat: number | null;
  lng: number | null;
  /** 件数。伏せるときは null */
  count: number | null;
};

export type IntentionChomeCell = {
  chome: ChomeId;
  name: string;
  /** 件数。伏せるときは null */
  count: number | null;
};

export type IntentionSummary = {
  /** 回答者数。伏せるときは null */
  respondents: number | null;
  /** 丁目ごと（1丁目から順） */
  chomes: IntentionChomeCell[];
  /** 場所ごと（区画番号の昇順） */
  places: IntentionPlaceCell[];
  minReportable: number;
};

export type IntentionSummaryRow = {
  /** 場所まで選んだときだけ入る */
  place_id: string | null;
  chome: number | null;
};

type Counted = { key: string; count: number };

/** 件数の一覧から、伏せる項目を決める。伏せた項目の合計を残りから逆算させないため、表示中の最小も伏せる */
function hiddenKeys(counted: Counted[]): Set<string> {
  const hide = new Set<string>(counted.filter((c) => c.count > 0 && c.count < INTENTION_MIN_REPORTABLE).map((c) => c.key));
  if (hide.size >= 1) {
    const candidates = counted.filter((c) => !hide.has(c.key) && c.count > 0);
    if (candidates.length > 0) {
      hide.add(candidates.reduce((a, b) => (b.count < a.count ? b : a)).key);
    }
  }
  return hide;
}

/** 回答の一覧から、丁目ごと・場所ごとの件数を作る。店舗ごとの情報は返さない */
export function summariseIntentions(
  rows: IntentionSummaryRow[],
  places: IntentionPlace[],
  options: { mask?: boolean } = {},
): IntentionSummary {
  const mask = options.mask !== false;
  const respondentCount = rows.length;
  const tallyChome = new Map<number, number>();
  const tallyPlace = new Map<string, number>();
  for (const row of rows) {
    if (row.chome !== null) tallyChome.set(row.chome, (tallyChome.get(row.chome) ?? 0) + 1);
    if (row.place_id) tallyPlace.set(row.place_id, (tallyPlace.get(row.place_id) ?? 0) + 1);
  }

  const chomeCounted = CHOMES.map((chome) => ({ key: String(chome.id), count: tallyChome.get(chome.id) ?? 0 }));
  const placeCounted = places.map((place) => ({ key: place.id, count: tallyPlace.get(place.id) ?? 0 }));
  const hideChome = mask ? hiddenKeys(chomeCounted) : new Set<string>();
  const hidePlace = mask ? hiddenKeys(placeCounted) : new Set<string>();
  // 回答者が少なすぎるときは、全部を伏せる
  const tooFew = mask && respondentCount < INTENTION_MIN_REPORTABLE;

  return {
    respondents: tooFew ? null : respondentCount,
    chomes: CHOMES.map((chome) => ({
      chome: chome.id,
      name: chome.shortName,
      count: tooFew || hideChome.has(String(chome.id)) ? null : (tallyChome.get(chome.id) ?? 0),
    })),
    places: places.map((place) => ({
      placeId: place.id,
      storeNumber: place.storeNumber,
      name: place.name,
      chome: place.chome,
      lat: place.lat,
      lng: place.lng,
      count: tooFew || hidePlace.has(place.id) ? null : (tallyPlace.get(place.id) ?? 0),
    })),
    minReportable: INTENTION_MIN_REPORTABLE,
  };
}
