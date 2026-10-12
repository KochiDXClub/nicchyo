/**
 * 現場登録の記録（field_shop_locations）。地図のデータ（market_locations）には反映しない。
 * マイグレーション前の DB ではテーブルが無いので、その場合は記録が無いものとして扱う。
 */
const UNDEFINED_TABLE_CODES: ReadonlySet<string> = new Set(["42P01", "PGRST205"]);

export function isMissingTableError(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && UNDEFINED_TABLE_CODES.has(error.code);
}
