/** 開催日を表す ISO 日付。JST の暦日として扱い、時刻・夏時間に依存しない。 */
export type MarketDate = string;
export type Recurrence =
  | { kind: "weekly" }
  | { kind: "fortnightly"; anchor: MarketDate }
  | { kind: "monthly"; weeks: number[] };
export type ScheduleRule = { id: string; periodId: string; locationId: string; vendorId: string; start: MarketDate; end: MarketDate | null; recurrence: Recurrence };
/** vendorId=null は明示的な休み。レコードなし（未設定）とは区別する。 */
export type MembershipPeriod = { id: string; locationId: string; vendorId: string; start: MarketDate; end: MarketDate | null };
export type ScheduleOverride = { locationId: string; date: MarketDate; vendorId: string | null };
export type PlannedDay = { date: MarketDate; locationId: string; state: "unplanned" | "closed" | "market_closed" | "scheduled" | "conflict"; vendorIds: string[]; source: "override" | "rule" | null };

const DAY_MS = 86_400_000;
function parseDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("日付の形式が正しくありません");
  const result = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(result) || new Date(result).toISOString().slice(0, 10) !== value) throw new Error("存在しない日付です");
  return result;
}
function assertSunday(value: MarketDate): number {
  const time = parseDate(value);
  if (new Date(time).getUTCDay() !== 0) throw new Error("開催日には日曜日を指定してください");
  return time;
}
export function occursOn(rule: ScheduleRule, date: MarketDate): boolean {
  const time = assertSunday(date);
  const start = assertSunday(rule.start);
  const end = rule.end === null ? null : assertSunday(rule.end);
  if (end !== null && end < start) throw new Error("終了日は開始日以降にしてください");
  const recurrence = rule.recurrence;
  if (recurrence.kind === "fortnightly") {
    const anchor = assertSunday(recurrence.anchor);
    return time >= start && (end === null || time <= end) && Math.abs((time - anchor) / DAY_MS) % 14 === 0;
  }
  if (recurrence.kind === "monthly") {
    if (!recurrence.weeks.length || recurrence.weeks.some((week) => !Number.isInteger(week) || week < 1 || week > 5)) throw new Error("第何日曜かは1〜5で指定してください");
    return time >= start && (end === null || time <= end) && recurrence.weeks.includes(Math.ceil(new Date(time).getUTCDate() / 7));
  }
  return time >= start && (end === null || time <= end);
}
/** 同じ住所・日付に例外が複数ある場合は、どれかを勝手に採用せず競合として返す。 */
export function resolveDay(locationId: string, date: MarketDate, rules: ScheduleRule[], overrides: ScheduleOverride[], periods: MembershipPeriod[]): PlannedDay {
  assertSunday(date);
  const active = (vendorId: string, periodId?: string) => periods.some((period) => {
    if (period.locationId !== locationId || period.vendorId !== vendorId) return false;
    if (periodId !== undefined && period.id !== periodId) return false;
    const start = parseDate(period.start);
    const end = period.end === null ? null : parseDate(period.end);
    if (end !== null && end < start) throw new Error("出店期間を確認してください");
    const target = parseDate(date);
    return target >= start && (end === null || target <= end);
  });
  const matching = overrides.filter((item) => item.locationId === locationId && item.date === date);
  if (matching.length > 1) return { date, locationId, state: "conflict", vendorIds: [...new Set(matching.flatMap((item) => item.vendorId ? [item.vendorId] : []))], source: "override" };
  if (matching.length === 1 && matching[0].vendorId !== null && !active(matching[0].vendorId)) return { date, locationId, state: "conflict", vendorIds: [matching[0].vendorId], source: "override" };
  if (matching.length === 1) return matching[0].vendorId === null
    ? { date, locationId, state: "closed", vendorIds: [], source: "override" }
    : { date, locationId, state: "scheduled", vendorIds: [matching[0].vendorId], source: "override" };
  const vendorIds = [...new Set(rules.filter((rule) => rule.locationId === locationId && active(rule.vendorId, rule.periodId) && occursOn(rule, date)).map((rule) => rule.vendorId))];
  return { date, locationId, state: vendorIds.length === 0 ? "unplanned" : vendorIds.length === 1 ? "scheduled" : "conflict", vendorIds, source: vendorIds.length ? "rule" : null };
}
export function sundaysBetween(from: MarketDate, through: MarketDate): MarketDate[] {
  const first = parseDate(from), last = parseDate(through);
  if (first > last || last - first > 366 * DAY_MS) throw new Error("期間を確認してください");
  const offset = (7 - new Date(first).getUTCDay()) % 7;
  const dates: MarketDate[] = [];
  for (let time = first + offset * DAY_MS; time <= last; time += 7 * DAY_MS) dates.push(new Date(time).toISOString().slice(0, 10));
  return dates;
}
