/**
 * 市の丁目（区画のエリア）。市ごとに管理画面で登録する。
 * label は区画の district に入る値（例: 日曜市の「一丁目」）で、区画の丁目はこの文字列で持つ。
 */

export type MarketArea = {
  id: string;
  marketId: string;
  label: string;
  sortOrder: number;
};

export const MARKET_AREA_LABEL_MAX_LENGTH = 10;

export type MarketAreaLabelResult = { ok: true; label: string } | { ok: false; error: string };

/** 丁目の名前（例: 一丁目・1丁目・A区）の入力を検証する。前後の空白は取り除く。 */
export function parseMarketAreaLabel(raw: unknown): MarketAreaLabelResult {
  if (typeof raw !== "string") return { ok: false, error: "丁目の名前を入力してください" };
  const label = raw.trim();
  if (label.length === 0 || [...label].length > MARKET_AREA_LABEL_MAX_LENGTH) {
    return { ok: false, error: `丁目の名前は1〜${MARKET_AREA_LABEL_MAX_LENGTH}文字で入力してください` };
  }
  if (/[\r\n\t]/.test(label)) return { ok: false, error: "丁目の名前に改行やタブは使えません" };
  return { ok: true, label };
}

export function sortMarketAreas(areas: readonly MarketArea[]): MarketArea[] {
  return [...areas].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * 丁目の並べ替え。id を direction（-1 で上、1 で下）へ1つ動かした id の並びを返す。
 * 端で動かせないときや、id が無いときは null。
 */
export function moveMarketAreaIds(ids: readonly string[], id: string, direction: -1 | 1): string[] | null {
  const index = ids.indexOf(id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
