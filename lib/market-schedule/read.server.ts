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
/**
 * 予定の計算（calendar.ts）は、いまは日曜市の日付だけを扱う。
 * 木曜市などの場所や予定が混ざると計算が例外になるため、読み込んだ後で日曜市の分だけに絞る。
 * 市ごとの計算は #1106 以降で行う。
 */
function limitToSundayMarket<T extends { id: string; market_id?: string | null }>(
  markets: { id: string; slug: string }[],
  places: T[],
  memberships: { id: string; location_id: string }[],
  periods: { membership_id: string }[],
  rules: { membership_id: string }[],
  overrides: { location_id: string }[],
) {
  const sundayId = markets.find((market) => market.slug === "nichiyo")?.id;
  const keptPlaces = places.filter((place) => place.market_id === sundayId);
  const placeIds = new Set(keptPlaces.map((place) => place.id));
  const keptMemberships = memberships.filter((membership) => placeIds.has(membership.location_id));
  const membershipIds = new Set(keptMemberships.map((membership) => membership.id));
  return {
    places: keptPlaces,
    memberships: keptMemberships,
    periods: periods.filter((period) => membershipIds.has(period.membership_id)),
    rules: rules.filter((rule) => membershipIds.has(rule.membership_id)),
    overrides: overrides.filter((override) => placeIds.has(override.location_id)),
  };
}

export async function readScheduleData(db: SupabaseClient, vendorId?: string): Promise<ScheduleAdminData> {
  const [markets, places0, vendors, memberships0, periods0, rules0, overrides0, marketDays, legacyAssignments] = await Promise.all([
    readScheduleRows(db, "markets", "id,slug", ["id"]),
    readScheduleRows(db, "market_locations", "id,market_id,store_number,official_number,branch_number,district,place_name,latitude,longitude", ["id"]),
    readScheduleRows(db, "vendors", "id,shop_name,market_place_id", ["id"]),
    readScheduleRows(db, "market_place_memberships", "id,location_id,vendor_id,vendor_number", ["id"]),
    readScheduleRows(db, "market_place_membership_periods", "id,membership_id,starts_on,ends_on", ["id"]),
    readScheduleRows(db, "market_place_schedule_rules", "id,membership_id,period_id,cadence,starts_on,ends_on,anchor_on,month_weeks,voided_at", ["id"]),
    readScheduleRows(db, "market_place_schedule_overrides", "location_id,market_date,membership_id,updated_at,revision,is_cleared", ["location_id", "market_date"]),
    readScheduleRows(db, "market_days", "market_date,status", ["market_date"]),
    readScheduleRows(db, "location_assignments", "id,vendor_id,location_id,market_date", ["id"], vendorId),
  ]);
  const scoped = limitToSundayMarket(markets as { id: string; slug: string }[], places0 as never[], memberships0 as never[], periods0 as never[], rules0 as never[], overrides0 as never[]);
  return { ...scoped, vendors, marketDays, legacyAssignments } as unknown as ScheduleAdminData;
}

/** 公開判定に必要な予定だけ。店舗名・旧配置の全履歴は取得しない。 */
export async function readPublicScheduleData(db: SupabaseClient): Promise<ScheduleAdminData> {
  const [markets, places, memberships, periods, rules, overrides] = await Promise.all([
    readScheduleRows(db, "markets", "id,slug", ["id"]),
    readScheduleRows(db, "market_locations", "id,market_id", ["id"]),
    readScheduleRows(db, "market_place_memberships", "id,location_id,vendor_id,vendor_number", ["id"]),
    readScheduleRows(db, "market_place_membership_periods", "id,membership_id,starts_on,ends_on", ["id"]),
    readScheduleRows(db, "market_place_schedule_rules", "id,membership_id,period_id,cadence,starts_on,ends_on,anchor_on,month_weeks,voided_at", ["id"]),
    readScheduleRows(db, "market_place_schedule_overrides", "location_id,market_date,membership_id,updated_at,revision,is_cleared", ["location_id", "market_date"]),
  ]);
  const scoped = limitToSundayMarket(markets as { id: string; slug: string }[], places as never[], memberships as never[], periods as never[], rules as never[], overrides as never[]);
  return { ...scoped, vendors: [], marketDays: [], legacyAssignments: [] } as unknown as ScheduleAdminData;
}
