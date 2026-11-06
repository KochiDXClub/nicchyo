import { describe, expect, it } from "vitest";
import { publicAssignmentsForDate } from "./publicAssignments";
import type { ScheduleAdminData } from "./adminTypes";
const data: ScheduleAdminData = {
  places: [{ id: "a", store_number: 1, official_number: 1, branch_number: null, district: null, place_name: null }, { id: "b", store_number: 2, official_number: 2, branch_number: null, district: null, place_name: null }],
  vendors: [{ id: "v1", shop_name: "店1" }, { id: "v2", shop_name: "店2" }],
  memberships: [{ id: "m", location_id: "a", vendor_id: "v1", vendor_number: 1 }],
  periods: [{ id: "p", membership_id: "m", starts_on: "2026-11-01", ends_on: null }],
  rules: [{ id: "r", membership_id: "m", period_id: "p", cadence: "fortnightly", starts_on: "2026-11-01", ends_on: null, anchor_on: "2026-11-01", month_weeks: null }], overrides: [],
};
const legacy = [{ vendor_id: "v1", location_id: "b", market_date: "2026-10-01" }, { vendor_id: "v1", location_id: "a", market_date: "2026-10-08" }, { vendor_id: "v2", location_id: "b", market_date: "2026-10-08" }];
const visible = new Set(["v1", "v2"]);
describe("公開予定への移行", () => {
  it("管理済みの場所は予定を使い、未移行の場所は旧配置を残す", () => {
    expect(publicAssignmentsForDate(data, "2026-11-01", legacy, visible)).toEqual([{ vendor_id: "v1", location_id: "a", market_date: "2026-11-01" }, legacy[2]]);
  });
  it("隔週の休みに古い配置が別の場所へ復活しない", () => {
    expect(publicAssignmentsForDate(data, "2026-11-08", legacy, visible)).toEqual([legacy[2]]);
  });
  it("中止日は旧配置を含め公開しない", () => {
    expect(publicAssignmentsForDate({ ...data, marketDays: [{ market_date: "2026-11-01", status: "cancelled" }] }, "2026-11-01", legacy, visible)).toEqual([]);
  });
  it("公開許可が無い店舗や競合した店舗を配置しない", () => {
    const conflict: ScheduleAdminData = { ...data, memberships: [...data.memberships, { id: "m2", location_id: "a", vendor_id: "v2", vendor_number: 2 }], periods: [...data.periods, { id: "p2", membership_id: "m2", starts_on: "2026-11-01", ends_on: null }], rules: [...data.rules, { ...data.rules[0], id: "r2", period_id: "p2", membership_id: "m2" }] };
    expect(publicAssignmentsForDate(conflict, "2026-11-01", legacy, visible)).toEqual([]);
    expect(publicAssignmentsForDate(data, "2026-11-01", legacy, new Set(["v2"]))).toEqual([legacy[2]]);
  });
  it("開始前は旧配置を残す", () => {
    expect(publicAssignmentsForDate(data, "2026-10-25", legacy, visible)).toEqual([legacy[1], legacy[2]]);
  });
});
