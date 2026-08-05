/**
 * 出店確度ラベル
 *
 * Supabase の RPC get_shop_attendance_estimates が返す label と 1:1 で対応する。
 * 定義元: supabase/migrations/20260414081611_remote_schema.sql の CASE 式
 */

export const ATTENDANCE_LABELS = {
  /** 出店者が「出す」と確定 */
  OPEN_CONFIRMED: '出店している',
  /** 出店者が「出さない」と確定 */
  CLOSED_CONFIRMED: '出店していない',
  /** 投票が3未満。デフォルト値でもある */
  UNKNOWN: 'わからない',
  /** p >= 0.85 */
  LIKELY_OPEN_HIGH: '出店している可能性が高い',
  /** p >= 0.70 */
  LIKELY_OPEN: 'おそらく出店している',
  /** 0.20 < p < 0.50 */
  MAYBE_CLOSED: '出店していないかもしれない',
  /** p <= 0.20 */
  LIKELY_CLOSED: '出店していない可能性が高い',
} as const;

export type AttendanceLabel = (typeof ATTENDANCE_LABELS)[keyof typeof ATTENDANCE_LABELS];

/**
 * マップ上で屋台をグレー表示にする対象。
 *
 * 確度の高い2つに限定している。投票が割れている MAYBE_CLOSED（p が 0.20〜0.50）を
 * 含めると、根拠の弱い断定を初来訪者に視覚的に押し付けることになるため
 * （docs/CONCEPT.md「不安を減らす」）。その帯の情報は ShopDetailBanner の
 * 出店状況テキストで、文言のニュアンス付きで伝える。
 */
export const CLOSED_ATTENDANCE_LABELS: ReadonlySet<string> = new Set<string>([
  ATTENDANCE_LABELS.CLOSED_CONFIRMED,
  ATTENDANCE_LABELS.LIKELY_CLOSED,
]);

/** ラベル未取得（undefined）は「グレーにしない」= 安全側に倒す */
export function isClosedAttendanceLabel(label?: string | null): boolean {
  return !!label && CLOSED_ATTENDANCE_LABELS.has(label);
}
