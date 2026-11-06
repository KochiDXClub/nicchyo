import { resolveSchedule } from "./resolve";
import type { ScheduleAdminData } from "./adminTypes";

export type PublicAssignment = { vendor_id: string | null; location_id: string | null; market_date: string | null };

/**
 * 新しい予定の管理が始まった場所・店舗には、古い配置を復活させない。
 * 未移行の場所は旧配置を残し、移行後の予定が休み・未設定・競合なら空欄にする。
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
    if (!visibleVendors.has(vendor) || managedVendors.has(vendor) || !row.location_id || managedLocations.has(row.location_id) || conflicted.has(vendor)) continue;
    next.push(row);
  }
  return next;
}
