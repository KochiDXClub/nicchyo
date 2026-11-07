import { FIELD_BOUNDS } from "@/lib/admin/shopLocation";
import type { EditableShop, EditableVendor } from "@/app/(public)/map/types/editableShop";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SharedMarketPlace = {
  id: string;
  name: string | null;
  storeNumber: number;
  vendors: { id: string; name: string }[];
};

/** PostgREST の行数上限で、後半の店舗や区画を取りこぼさない。 */
export async function readAllMarketRows(client: SupabaseClient, table: string, columns: string, nonNullColumn: string, orderColumn = "id") {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from(table).select(columns).not(nonNullColumn, "is", null).order(orderColumn).range(offset, offset + pageSize - 1);
    if (error) return { data: null, error };
    const page = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) return { data: rows, error: null };
  }
}

/** 管理者の画面に出す、すべての区画とそこに登録された店舗。 */
export async function loadSharedMarketPlaces(client: SupabaseClient): Promise<Map<string, SharedMarketPlace>> {
  const [places, vendors, assignments, memberships] = await Promise.all([
    readAllMarketRows(client, "market_locations", "id, store_number, place_name", "id"),
    readAllMarketRows(client, "vendors", "id, shop_name, market_place_id", "id"),
    readAllMarketRows(client, "location_assignments", "id, vendor_id, location_id, market_date, created_at", "vendor_id"),
    readAllMarketRows(client, "market_place_memberships", "id, vendor_id, location_id", "id"),
  ]);
  const errors = [places.error, vendors.error, assignments.error, memberships.error].filter(Boolean);
  if (errors.length && errors.every((error) => error?.code === "42703")) return new Map();
  if (errors.length) throw new Error("Failed to load shared market places");
  const result = new Map<string, SharedMarketPlace>();
  for (const place of places.data ?? []) result.set(place.id as string, { id: place.id as string, name: (place.place_name as string | null) ?? null, storeNumber: place.store_number as number, vendors: [] });
  const latest = new Map<string, { locationId: string; date: string; created: string; id: string }>();
  for (const row of assignments.data ?? []) {
    const id = row.vendor_id as string;
    const date = (row.market_date as string | null) ?? "";
    const created = (row.created_at as string | null) ?? "";
    const rowId = (row.id as string | null) ?? "";
    const previous = latest.get(id);
    if (!previous || date > previous.date || (date === previous.date && (created > previous.created || (created === previous.created && rowId > previous.id)))) latest.set(id, { locationId: row.location_id as string, date, created, id: rowId });
  }
  const vendorById = new Map((vendors.data ?? []).map((vendor) => [vendor.id as string, vendor]));
  const linkedPairs = new Set<string>();
  for (const membership of memberships.data ?? []) {
    const vendor = vendorById.get(membership.vendor_id as string);
    if (!vendor) continue;
    linkedPairs.add(`${String(vendor.id)}:${String(membership.location_id)}`);
    result.get(membership.location_id as string)?.vendors.push({ id: vendor.id as string, name: vendor.shop_name as string });
  }
  for (const vendor of vendors.data ?? []) {
    const locationId = (vendor.market_place_id as string | null) ?? latest.get(vendor.id as string)?.locationId;
    if (locationId && !linkedPairs.has(`${String(vendor.id)}:${locationId}`)) result.get(locationId)?.vendors.push({ id: vendor.id as string, name: vendor.shop_name as string });
  }
  return result;
}

export async function attachSharedMarketPlaces(client: SupabaseClient, shops: EditableShop[]): Promise<EditableShop[]> {
  const places = await loadSharedMarketPlaces(client);
  return shops.map((shop) => {
    const place = places.get(shop.locationId);
    return place ? { ...shop, placeName: place.name ?? undefined, placeVendors: place.vendors } : shop;
  });
}

/** 保存後の区画で、店番が重なっていないか */
export function findDuplicatePosition(shops: EditableShop[]): number | null {
  const seen = new Set<number>();
  for (const shop of shops) {
    if (seen.has(shop.position)) return shop.position;
    seen.add(shop.position);
  }
  return null;
}

/** 保存後の区画で、住所録の番号（本番号＋枝番）が重なっていないか */
export function findDuplicateOfficialNumber(shops: EditableShop[]): string | null {
  const seen = new Set<string>();
  for (const shop of shops) {
    if (shop.officialNumber == null) continue;
    const key = `${shop.officialNumber}-${shop.branchNumber ?? 0}`;
    if (seen.has(key)) return shop.branchNumber != null ? `${shop.officialNumber}-${shop.branchNumber}` : String(shop.officialNumber);
    seen.add(key);
  }
  return null;
}

/** 現場記録は確認用として読み、地図の区画には自動で反映しない。 */
export async function attachFieldObservations(client: SupabaseClient, vendors: EditableVendor[]): Promise<EditableVendor[]> {
  const result = await readAllMarketRows(client, "field_shop_locations", "vendor_id, store_number, latitude, longitude, accuracy_m, source, updated_at", "latitude", "vendor_id");
  if (result.error?.code === "42P01" || result.error?.code === "PGRST205") return vendors;
  if (result.error) throw new Error("Failed to load field location observations");
  const observations = new Map<string, NonNullable<EditableVendor["fieldObservation"]>>();
  for (const row of result.data ?? []) {
    const lat = row.latitude, lng = row.longitude;
    if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < FIELD_BOUNDS.minLat || lat > FIELD_BOUNDS.maxLat || lng < FIELD_BOUNDS.minLng || lng > FIELD_BOUNDS.maxLng || typeof row.updated_at !== "string") continue;
    observations.set(row.vendor_id as string, { lat, lng, storeNumber: typeof row.store_number === "number" ? row.store_number : null, accuracyM: typeof row.accuracy_m === "number" ? row.accuracy_m : null, source: typeof row.source === "string" ? row.source : null, updatedAt: row.updated_at });
  }
  return vendors.map((vendor) => observations.has(vendor.id) ? { ...vendor, fieldObservation: observations.get(vendor.id) } : vendor);
}
