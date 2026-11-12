import { describe, expect, it } from "vitest";
import { publicScheduleAssignments, resolveSchedule } from "./resolve";
import type { ScheduleAdminData } from "./adminTypes";
const data: ScheduleAdminData = {
  places: [{ id: "a", store_number: 1, official_number: 183, branch_number: 1, district: null, place_name: null }, { id: "b", store_number: 2, official_number: 183, branch_number: 2, district: null, place_name: null }],
  vendors: [{ id: "v", shop_name: "店" }, { id: "private", shop_name: "非公開" }],
  memberships: [{ id: "m1", location_id: "a", vendor_id: "v", vendor_number: 1 }, { id: "m2", location_id: "b", vendor_id: "private", vendor_number: 1 }],
  periods: [{ id: "p1", membership_id: "m1", starts_on: "2026-01-01", ends_on: null }, { id: "p2", membership_id: "m2", starts_on: "2026-01-01", ends_on: null }],
  rules: [{ id: "r1", membership_id: "m1", period_id: "p1", cadence: "weekly", starts_on: "2026-11-01", ends_on: null, anchor_on: null, month_weeks: null }, { id: "r2", membership_id: "m2", period_id: "p2", cadence: "weekly", starts_on: "2026-11-01", ends_on: null, anchor_on: null, month_weeks: null }], overrides: [],
};
describe("公開する出店予定", () => {
  it("市全体が中止の日は、繰り返し予定があっても出店しない", () => {
    const cancelled = { ...data, marketDays: [{ market_date: "2026-11-08", status: "cancelled" }] };
    expect(resolveSchedule(cancelled, "2026-11-08").every((item) => item.state === "market_closed")).toBe(true);
    expect(publicScheduleAssignments(cancelled, "2026-11-08", new Set(["v"]))).toEqual([]);
  });
  it("公開を許可された店舗だけを、その日付の場所に表示する", () => {
    expect(publicScheduleAssignments(data, "2026-11-08", new Set(["v"]))).toEqual([{ vendor_id: "v", location_id: "a", market_date: "2026-11-08" }]);
  });
  it("同日に同じ店舗が複数の場所に出る場合は、片方を勝手に選ばない", () => {
    const duplicate = { ...data, memberships: [...data.memberships, { id: "m3", location_id: "b", vendor_id: "v", vendor_number: 2 }], periods: [...data.periods, { id: "p3", membership_id: "m3", starts_on: "2026-01-01", ends_on: null }], rules: [...data.rules.filter((r) => r.id !== "r2"), { id: "r3", membership_id: "m3", period_id: "p3", cadence: "weekly" as const, starts_on: "2026-11-01", ends_on: null, anchor_on: null, month_weeks: null }] };
    expect(publicScheduleAssignments(duplicate, "2026-11-08", new Set(["v"]))).toEqual([]);
  });
  it("同じ場所で別店舗の予定が競合すると、非公開店舗を除外する前に競合として扱う", () => {
    const conflict = { ...data, memberships: [...data.memberships, { id: "m3", location_id: "a", vendor_id: "private", vendor_number: 2 }], periods: [...data.periods, { id: "p3", membership_id: "m3", starts_on: "2026-01-01", ends_on: null }], rules: [...data.rules, { id: "r3", membership_id: "m3", period_id: "p3", cadence: "weekly" as const, starts_on: "2026-11-01", ends_on: null, anchor_on: null, month_weeks: null }] };
    expect(publicScheduleAssignments(conflict, "2026-11-08", new Set(["v"]))).toEqual([]);
  });
});
