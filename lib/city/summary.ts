/**
 * 高知市のページに出す数字を、取得済みの集計データから作る（純粋関数）。
 */

import { addDaysToDateString } from "@/lib/time/jstDate";

export type VisitorSummary = {
  /** 直近28日の合計 */
  total28: number;
  /** 直近28日の1日あたり（四捨五入） */
  average28: number;
  /** 記録のある日数（欠けている日があれば28より小さい） */
  recordedDays: number;
};

/** 直近28日（今日を含む）の Web 来訪者数。記録が無ければ null */
export function summariseVisitors(
  rows: { visit_date?: unknown; visitor_count?: unknown }[],
  todayIso: string
): VisitorSummary | null {
  const since = addDaysToDateString(todayIso, -27);
  let total = 0;
  let days = 0;
  for (const row of rows) {
    const date = typeof row.visit_date === "string" ? row.visit_date : "";
    if (date < since || date > todayIso) continue;
    total += Number(row.visitor_count ?? 0) || 0;
    days += 1;
  }
  if (days === 0) return null;
  return { total28: total, average28: Math.round(total / days), recordedDays: days };
}

export type MarketDaySummary = Record<"open" | "cancelled" | "special" | "closed", number>;

/** その年の開催実績（ステータスごとの回数） */
export function summariseMarketDays(
  rows: { market_date?: unknown; status?: unknown }[],
  year: number
): MarketDaySummary {
  const result: MarketDaySummary = { open: 0, cancelled: 0, special: 0, closed: 0 };
  for (const row of rows) {
    const date = typeof row.market_date === "string" ? row.market_date : "";
    const status = typeof row.status === "string" ? row.status : "";
    if (!date.startsWith(`${year}-`)) continue;
    if (status in result) result[status as keyof MarketDaySummary] += 1;
  }
  return result;
}
