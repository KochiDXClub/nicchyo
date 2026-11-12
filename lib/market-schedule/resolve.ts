import { resolveDay, type MembershipPeriod, type ScheduleOverride, type ScheduleRule } from "./calendar";
import type { ScheduleAdminData } from "./adminTypes";

/** 管理画面と公開マップで同じ日時の解決規則を使う。 */
export function resolveSchedule(data: ScheduleAdminData, date: string) {
  const marketDay = data.marketDays?.find((item) => item.market_date === date);
  if (marketDay?.status === "cancelled" || marketDay?.status === "closed") {
    return data.places.map((place) => ({ date, locationId: place.id, state: "market_closed" as const, vendorIds: [], source: null }));
  }
  const index = new Map(data.memberships.map((item) => [item.id, item]));
  const periods: MembershipPeriod[] = data.periods.flatMap((item) => {
    const member = index.get(item.membership_id);
    return member ? [{ id: item.id, locationId: member.location_id, vendorId: member.vendor_id, start: item.starts_on, end: item.ends_on }] : [];
  });
  const rules: ScheduleRule[] = data.rules.filter((item) => !item.voided_at).flatMap((item) => {
    const member = index.get(item.membership_id);
    if (!member) return [];
    const recurrence = item.cadence === "monthly" ? { kind: "monthly" as const, weeks: item.month_weeks ?? [] } : item.cadence === "fortnightly" ? { kind: "fortnightly" as const, anchor: item.anchor_on ?? item.starts_on } : { kind: "weekly" as const };
    return [{ id: item.id, periodId: item.period_id, locationId: member.location_id, vendorId: member.vendor_id, start: item.starts_on, end: item.ends_on, recurrence }];
  });
  const overrides: ScheduleOverride[] = data.overrides.filter((item) => !item.is_cleared).map((item) => ({ locationId: item.location_id, date: item.market_date, vendorId: item.membership_id === null ? null : index.get(item.membership_id)?.vendor_id ?? "missing" }));
  const result = data.places.map((place) => resolveDay(place.id, date, rules, overrides, periods));
  const appearances = new Map<string, number>();
  for (const item of result) for (const vendorId of item.vendorIds) appearances.set(vendorId, (appearances.get(vendorId) ?? 0) + 1);
  return result.map((item) => item.state === "scheduled" && (appearances.get(item.vendorIds[0]) ?? 0) > 1 ? { ...item, state: "conflict" as const } : item);
}

/** 競合した場所や、同日に複数場所へ割り当てられた店舗を勝手に公開しない。 */
export function publicScheduleAssignments(data: ScheduleAdminData, date: string, visibleVendorIds: ReadonlySet<string>) {
  const plan = resolveSchedule(data, date);
  const count = new Map<string, number>();
  const conflicted = new Set(plan.filter((item) => item.state === "conflict").flatMap((item) => item.vendorIds));
  for (const item of plan) if (item.state === "scheduled") count.set(item.vendorIds[0], (count.get(item.vendorIds[0]) ?? 0) + 1);
  return plan.flatMap((item) => {
    const vendorId = item.vendorIds[0];
    if (item.state !== "scheduled" || !visibleVendorIds.has(vendorId) || count.get(vendorId) !== 1 || conflicted.has(vendorId)) return [];
    return [{ vendor_id: vendorId, location_id: item.locationId, market_date: date }];
  });
}
