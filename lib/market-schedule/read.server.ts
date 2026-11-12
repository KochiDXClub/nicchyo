import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScheduleAdminData } from "./adminTypes";

/** 管理者用データ。PostgRESTの上限を超えても後半を黙って欠落させない。 */
export async function readScheduleRows(client: SupabaseClient, table: string, fields: string, order: string[], vendorId?: string) {
  const result: Record<string, unknown>[] = [];
  for (let start = 0; ; start += 500) {
    let query = client.from(table).select(fields);
    if (vendorId) query = query.eq("vendor_id", vendorId);
    for (const key of order) query = query.order(key);
    const { data, error } = await query.range(start, start + 499);
    if (error) throw new Error(`Failed to load ${table}`);
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    result.push(...page);
    if (page.length < 500) return result;
  }
}
export async function readScheduleData(db: SupabaseClient, vendorId?: string): Promise<ScheduleAdminData> {
  const [places, vendors, memberships, periods, rules, overrides, marketDays, legacyAssignments] = await Promise.all([
    readScheduleRows(db, "market_locations", "id,store_number,official_number,branch_number,district,place_name", ["id"]),
    readScheduleRows(db, "vendors", "id,shop_name,market_place_id", ["id"]),
    readScheduleRows(db, "market_place_memberships", "id,location_id,vendor_id,vendor_number", ["id"]),
    readScheduleRows(db, "market_place_membership_periods", "id,membership_id,starts_on,ends_on", ["id"]),
    readScheduleRows(db, "market_place_schedule_rules", "id,membership_id,period_id,cadence,starts_on,ends_on,anchor_on,month_weeks,voided_at", ["id"]),
    readScheduleRows(db, "market_place_schedule_overrides", "location_id,market_date,membership_id,updated_at,revision,is_cleared", ["location_id", "market_date"]),
    readScheduleRows(db, "market_days", "market_date,status", ["market_date"]),
    readScheduleRows(db, "location_assignments", "id,vendor_id,location_id,market_date", ["id"], vendorId),
  ]);
  return { places, vendors, memberships, periods, rules, overrides, marketDays, legacyAssignments } as unknown as ScheduleAdminData;
}

/** 公開判定に必要な予定だけ。店舗名・旧配置の全履歴は取得しない。 */
export async function readPublicScheduleData(db: SupabaseClient): Promise<ScheduleAdminData> {
  const [places, memberships, periods, rules, overrides] = await Promise.all([
    readScheduleRows(db, "market_locations", "id", ["id"]),
    readScheduleRows(db, "market_place_memberships", "id,location_id,vendor_id,vendor_number", ["id"]),
    readScheduleRows(db, "market_place_membership_periods", "id,membership_id,starts_on,ends_on", ["id"]),
    readScheduleRows(db, "market_place_schedule_rules", "id,membership_id,period_id,cadence,starts_on,ends_on,anchor_on,month_weeks,voided_at", ["id"]),
    readScheduleRows(db, "market_place_schedule_overrides", "location_id,market_date,membership_id,updated_at,revision,is_cleared", ["location_id", "market_date"]),
  ]);
  return { places, vendors: [], memberships, periods, rules, overrides, marketDays: [], legacyAssignments: [] } as unknown as ScheduleAdminData;
}
