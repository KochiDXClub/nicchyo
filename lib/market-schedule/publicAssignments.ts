import { resolveSchedule } from "./resolve";
import type { ScheduleAdminData } from "./adminTypes";
import type { ShopProfile } from "@/app/(public)/map/types/shopData";

export type PublicAssignment = { vendor_id: string | null; location_id: string | null; market_date: string | null };

/** 不明な予定は休みと断定せず、競合する場合も確認中とする。 */
export function publicVendorStatuses(data: ScheduleAdminData, date: string, vendorIds: readonly string[]): Map<string, NonNullable<ShopProfile["nextMarketStatus"]>> {
  const closed = data.marketDays?.some((day) => day.market_date === date && (day.status === "cancelled" || day.status === "closed"));
  const result = new Map<string, NonNullable<ShopProfile["nextMarketStatus"]>>();
  if (closed) {
    for (const id of vendorIds) result.set(id, "market_closed");
    return result;
  }
  const plan = resolveSchedule(data, date);
  const conflicts = new Set(plan.filter((entry) => entry.state === "conflict").flatMap((entry) => entry.vendorIds));
  const scheduled = new Set(plan.filter((entry) => entry.state === "scheduled").flatMap((entry) => entry.vendorIds));
  const memberships = new Map(data.memberships.map((entry) => [entry.id, entry]));
  const periods = new Map(data.periods.map((entry) => [entry.id, entry]));
  const placeIds = new Set(data.places.map((entry) => entry.id));
  const hasRule = new Set<string>();
  const uncertain = new Set<string>();
  for (const rule of data.rules) {
    const membership = memberships.get(rule.membership_id);
    const period = periods.get(rule.period_id);
    if (!membership || rule.voided_at) continue;
    if (!period || period.membership_id !== membership.id || !placeIds.has(membership.location_id)) { uncertain.add(membership.vendor_id); continue; }
    if (period.starts_on > date || (period.ends_on && period.ends_on < date) || rule.starts_on > date || (rule.ends_on && rule.ends_on < date)) continue;
    hasRule.add(membership.vendor_id);
  }
  for (const id of vendorIds) result.set(id, conflicts.has(id) || uncertain.has(id) ? "unknown" : scheduled.has(id) ? "scheduled" : hasRule.has(id) ? "not_scheduled" : "unknown");
  return result;
}

/**
 * 新しい予定の管理が始まった場所・店舗には、古い配置を復活させない。
 * 指定日に一致する旧配置だけを残し、古い日の記録を現在の出店予定として表示しない。
 */
export function publicAssignmentsForDate(data: ScheduleAdminData, date: string, legacy: PublicAssignment[], visibleVendors: ReadonlySet<string>): PublicAssignment[] {
  if (data.marketDays?.some((day) => day.market_date === date && (day.status === "cancelled" || day.status === "closed"))) return [];
  const plan = resolveSchedule(data, date);
  const members = new Map(data.memberships.map((item) => [item.id, item]));
  const managedLocations = new Set<string>();
  const managedVendors = new Set<string>();
  for (const period of data.periods) {
    if (period.starts_on > date) continue;
    const member = members.get(period.membership_id);
    if (member) { managedLocations.add(member.location_id); managedVendors.add(member.vendor_id); }
  }
  for (const override of data.overrides) {
    if (override.market_date === date && !override.is_cleared) managedLocations.add(override.location_id);
  }
  const conflicted = new Set(plan.filter((item) => item.state === "conflict").flatMap((item) => item.vendorIds));
  const next: PublicAssignment[] = [];
  for (const item of plan) {
    const vendor = item.vendorIds[0];
    if (item.state === "scheduled" && vendor && visibleVendors.has(vendor) && !conflicted.has(vendor)) {
      next.push({ vendor_id: vendor, location_id: item.locationId, market_date: date });
      managedLocations.add(item.locationId); managedVendors.add(vendor);
    }
  }
  // 旧配置は元の最新行を先に選ぶ。管理済みの場所を除外してから選ぶと、
  // それより古い別場所の履歴が「現在の配置」として復活してしまう。
  const latest = new Map<string, PublicAssignment>();
  for (const row of legacy) {
    if (!row.vendor_id || !row.location_id) continue;
    const previous = latest.get(row.vendor_id);
    if (!previous || (row.market_date ?? "") > (previous.market_date ?? "")) latest.set(row.vendor_id, row);
  }
  for (const [vendor, row] of latest) {
    if (!visibleVendors.has(vendor) || managedVendors.has(vendor) || !row.location_id || row.market_date !== date || managedLocations.has(row.location_id) || conflicted.has(vendor)) continue;
    next.push(row);
  }
  return next;
}
