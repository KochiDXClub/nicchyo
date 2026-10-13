/**
 * 日曜市の「丁目」（1〜7）。DB の chomes（マスタ）と同じ内容。
 *
 * 日曜市独自の区分で、開催場所の住所（高知市追手筋1・2丁目）とは別物。
 * 東端が1丁目で西へ6丁目まで追手筋が続き、7丁目だけは大橋通り沿い。
 * 番号範囲は住所録（2024年版）の値で毎年変わりうるので、判定には使わず警告の目安にだけ使う。
 */

export type ChomeId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Chome = {
  id: ChomeId;
  /** 「日曜市1丁目」 */
  name: string;
  /** 「1丁目」 */
  shortName: string;
  roadName: string;
  eastBoundary: string | null;
  westBoundary: string | null;
  /** 住所録の配色 */
  color: string;
  refNumberMin: number;
  refNumberMax: number;
};

export const CHOMES: readonly Chome[] = [
  { id: 1, name: "日曜市1丁目", shortName: "1丁目", roadName: "追手筋", eastBoundary: "駅前電車通り", westBoundary: "廿代通り", color: "#7FD3F7", refNumberMin: 2, refNumberMax: 88 },
  { id: 2, name: "日曜市2丁目", shortName: "2丁目", roadName: "追手筋", eastBoundary: "廿代通り", westBoundary: "グリーンロード", color: "#7FD1A2", refNumberMin: 90, refNumberMax: 144 },
  { id: 3, name: "日曜市3丁目", shortName: "3丁目", roadName: "追手筋", eastBoundary: "グリーンロード", westBoundary: "堀詰通り", color: "#F9A71A", refNumberMin: 145, refNumberMax: 220 },
  { id: 4, name: "日曜市4丁目", shortName: "4丁目", roadName: "追手筋", eastBoundary: "堀詰通り", westBoundary: "中の橋通り", color: "#FFF100", refNumberMin: 222, refNumberMax: 307 },
  { id: 5, name: "日曜市5丁目", shortName: "5丁目", roadName: "追手筋", eastBoundary: "中の橋通り", westBoundary: "大橋通り", color: "#F481A9", refNumberMin: 310, refNumberMax: 452 },
  { id: 6, name: "日曜市6丁目", shortName: "6丁目", roadName: "追手筋", eastBoundary: "大橋通り", westBoundary: "追手門（高知城）", color: "#D9E60F", refNumberMin: 455, refNumberMax: 596 },
  { id: 7, name: "日曜市7丁目", shortName: "7丁目", roadName: "大橋通り", eastBoundary: "追手筋との交差点から南へ", westBoundary: null, color: "#9DB4E0", refNumberMin: 617, refNumberMax: 644 },
];

const FULLWIDTH_DIGITS = "０１２３４５６７８９";
const KANJI_DIGITS = "一二三四五六七";

/**
 * 「3」「３」「3丁目」「三丁目」「日曜市3丁目」などを 1〜7 に直す（DB の normalize_chome_number と同じ規則）。
 * 1〜7 に読めないもの（空欄・8丁目・別の文字）は null。自動では変換しない。
 */
export function normalizeChomeId(value: string | null | undefined): ChomeId | null {
  if (!value) return null;
  const compact = value.replace(/日曜市|丁目|\s|　/g, "");
  if (compact.length !== 1) return null;
  const fullwidth = FULLWIDTH_DIGITS.indexOf(compact);
  const kanji = KANJI_DIGITS.indexOf(compact);
  const n = fullwidth >= 0 ? fullwidth : kanji >= 0 ? kanji + 1 : Number(compact);
  return Number.isInteger(n) && n >= 1 && n <= 7 ? (n as ChomeId) : null;
}

/** 区画の district（market_locations.district）に入っている表記。DB と画面の既存の値 */
export const CHOME_LEGACY_LABELS = ["一丁目", "二丁目", "三丁目", "四丁目", "五丁目", "六丁目", "七丁目"] as const;

export function legacyChomeLabel(id: ChomeId): (typeof CHOME_LEGACY_LABELS)[number] {
  return CHOME_LEGACY_LABELS[id - 1];
}

export function getChome(id: number | null | undefined): Chome | null {
  return CHOMES.find((chome) => chome.id === id) ?? null;
}

/** 店番が、その丁目の参考範囲（住所録の値）から外れていたら true。警告の目安で、保存は止めない */
export function isOutsideReferenceRange(chomeId: ChomeId, storeNumber: number): boolean {
  const chome = getChome(chomeId);
  return !!chome && (storeNumber < chome.refNumberMin || storeNumber > chome.refNumberMax);
}
