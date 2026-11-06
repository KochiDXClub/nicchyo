import { describe, expect, it } from "vitest";
import { occursOn, resolveDay, sundaysBetween, type ScheduleRule } from "./calendar";
const weekly: ScheduleRule = { id: "a", locationId: "place", vendorId: "a", start: "2026-11-01", end: null, recurrence: { kind: "weekly" } };
describe("出店予定", () => {
  it("第１・３日曜と隔週は第５日曜をまたぐと異なる", () => {
    const monthly: ScheduleRule = { ...weekly, recurrence: { kind: "monthly", weeks: [1, 3] } };
    const fortnightly: ScheduleRule = { ...weekly, recurrence: { kind: "fortnightly", anchor: "2026-11-01" } };
    expect(occursOn(monthly, "2026-11-29")).toBe(false);
    expect(occursOn(fortnightly, "2026-11-29")).toBe(true);
    expect(occursOn(monthly, "2026-12-06")).toBe(true);
    expect(occursOn(fortnightly, "2026-12-06")).toBe(false);
  });
  it("特定日の変更・休みが基本予定に優先し、未設定と休みを区別する", () => {
    expect(resolveDay("place", "2026-11-08", [weekly], [{ locationId: "place", date: "2026-11-08", vendorId: "event" }])).toMatchObject({ state: "scheduled", vendorIds: ["event"], source: "override" });
    expect(resolveDay("place", "2026-11-08", [weekly], [{ locationId: "place", date: "2026-11-08", vendorId: null }]).state).toBe("closed");
    expect(resolveDay("other", "2026-11-08", [weekly], []).state).toBe("unplanned");
  });
  it("同じ日に別店舗の基本予定が重なれば勝手に選ばず競合を返す", () => {
    expect(resolveDay("place", "2026-11-08", [weekly, { ...weekly, id: "b", vendorId: "b" }], [])).toMatchObject({ state: "conflict", vendorIds: ["a", "b"] });
    expect(resolveDay("place", "2026-11-08", [weekly, { ...weekly, id: "c" }], []).state).toBe("scheduled");
  });
  it("月またぎの日曜日を列挙し、存在しない日付は拒否する", () => {
    expect(sundaysBetween("2026-11-25", "2026-12-14")).toEqual(["2026-11-29", "2026-12-06", "2026-12-13"]);
    expect(() => sundaysBetween("2026-02-30", "2026-03-31")).toThrow();
    expect(() => occursOn(weekly, "2026-11-09")).toThrow();
  });
});
