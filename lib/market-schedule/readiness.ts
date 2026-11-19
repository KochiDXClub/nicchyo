import { addDaysToDateString } from "@/lib/time/jstDate";
import { sundaysBetween } from "./calendar";
import { resolveSchedule } from "./resolve";
import type { ScheduleAdminData } from "./adminTypes";

/** 公開前に、次の日曜の表示と６週間の競合を確認する。 */
export function publicScheduleReadiness(schedule: ScheduleAdminData, date: string) {
  const dates = sundaysBetween(date, addDaysToDateString(date, 41));
  const plans = dates.map((day) => resolveSchedule(schedule, day));
  const first = plans[0] ?? [];
  const started = new Set(schedule.periods.filter((period) => period.starts_on <= date).map((period) => period.membership_id));
  const managed = new Set(schedule.memberships.filter((member) => started.has(member.id)).map((member) => member.location_id));
  return {
    date,
    scheduled: first.filter((item) => item.state === "scheduled").length,
    conflicts: plans.reduce((count, plan) => count + plan.filter((item) => item.state === "conflict").length, 0),
    unplanned: first.filter((item) => item.state === "unplanned" && managed.has(item.locationId)).length,
    closed: first.some((item) => item.state === "market_closed"),
  };
}
