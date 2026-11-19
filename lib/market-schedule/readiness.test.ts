import { describe, expect, it } from "vitest";
import { publicScheduleReadiness } from "./readiness";
import type { ScheduleAdminData } from "./adminTypes";
const schedule: ScheduleAdminData = {
  places: [{ id: "a", store_number: 1, official_number: 1, branch_number: null, district: null, place_name: null }],
  vendors: [], memberships: [{ id: "m1", location_id: "a", vendor_id: "v1", vendor_number: 1 }, { id: "m2", location_id: "a", vendor_id: "v2", vendor_number: 2 }],
  periods: [{ id: "p1", membership_id: "m1", starts_on: "2026-11-01", ends_on: null }, { id: "p2", membership_id: "m2", starts_on: "2026-11-01", ends_on: null }],
  rules: [{ id: "r1", period_id: "p1", membership_id: "m1", cadence: "weekly", starts_on: "2026-11-01", ends_on: null, anchor_on: null, month_weeks: null }, { id: "r2", period_id: "p2", membership_id: "m2", cadence: "weekly", starts_on: "2026-11-15", ends_on: null, anchor_on: null, month_weeks: null }], overrides: [],
};
describe("公開前の予定確認", () => {
  it("次回だけでなく６週間以内の競合を検出する", () => {
    const summary = publicScheduleReadiness(schedule, "2026-11-01");
    expect(summary.scheduled).toBe(1);
    expect(summary.conflicts).toBe(4);
  });
});
