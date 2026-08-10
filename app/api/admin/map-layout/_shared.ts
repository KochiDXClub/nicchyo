import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import type { MapRoad, MapRoutePoint, RoadKind } from "@/app/(public)/map/types/mapRoute";
import { projectPointOntoRoute } from "@/app/(public)/map/utils/mapRouteGeometry";

export type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
  chome?: string;
};

export type EditableRoad = MapRoad & {
  points: MapRoutePoint[];
};

const CHOME_VALUES = new Set(["一丁目", "二丁目", "三丁目", "四丁目", "五丁目", "六丁目", "七丁目"]);

function normalizeChome(value: string | null): string | undefined {
  return value && CHOME_VALUES.has(value) ? value : undefined;
}

export function createAdminWriteClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase service role env vars are missing.");
  }

  return createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function loadEditableShops(supabase: ReturnType<typeof createServerClient>): Promise<EditableShop[]> {
  const [assignmentsResult, locationsResult, vendorsResult] = await Promise.all([
    supabase.from("location_assignments").select("vendor_id, location_id, market_date"),
    supabase.from("market_locations").select("id, store_number, latitude, longitude, district"),
    supabase.from("vendors").select("id, shop_name"),
  ]);

  if (assignmentsResult.error || locationsResult.error || vendorsResult.error) {
    throw new Error("Failed to load shop location mappings");
  }

  const assignmentsData = assignmentsResult.data ?? [];
  const locationsData = locationsResult.data ?? [];
  const vendorsData = vendorsResult.data ?? [];

  const vendorNameById = new Map<string, string>();
  for (const row of vendorsData) {
    if (row.id) {
      vendorNameById.set(row.id as string, (row.shop_name as string | null) ?? "");
    }
  }

  const latestAssignmentByLocation = new Map<string, { vendor_id: string | null; market_date: string | null }>();
  for (const row of assignmentsData) {
    const locationId = row.location_id as string | null;
    if (!locationId) continue;
    const current = latestAssignmentByLocation.get(locationId);
    if (!current) {
      latestAssignmentByLocation.set(locationId, {
        vendor_id: (row.vendor_id as string | null) ?? null,
        market_date: (row.market_date as string | null) ?? null,
      });
      continue;
    }
    const currentDate = current.market_date ? new Date(current.market_date) : null;
    const nextDate = row.market_date ? new Date(row.market_date as string) : null;
    if (!currentDate || (nextDate && nextDate > currentDate)) {
      latestAssignmentByLocation.set(locationId, {
        vendor_id: (row.vendor_id as string | null) ?? null,
        market_date: (row.market_date as string | null) ?? null,
      });
    }
  }

  return locationsData
    .flatMap((row) => {
      const locationId = row.id as string | null;
      const storeNumber = Number(row.store_number ?? 0);
      const lat = Number(row.latitude ?? 0);
      const lng = Number(row.longitude ?? 0);

      if (!locationId || !Number.isFinite(storeNumber) || storeNumber <= 0) {
        return [];
      }

      const latestAssignment = latestAssignmentByLocation.get(locationId);
      const vendorId = latestAssignment?.vendor_id ?? undefined;
      const vendorName = vendorId ? vendorNameById.get(vendorId) ?? "" : "";

      return [
        {
          locationId,
          id: storeNumber,
          vendorId,
          name: vendorName || `未設定店舗 ${storeNumber}`,
          lat,
          lng,
          position: storeNumber,
          chome: normalizeChome((row.district as string | null) ?? null),
        },
      ];
    })
    .sort((a, b) => a.position - b.position);
}

/**
 * map_route_points を road_id の有無に関わらず全件取得する。
 * スナップショット作成時、road_id が未設定のポイントも欠落させないために使う
 * （loadEditableRoads は road_id が付いた点しかバケツに入れないため代用できない）。
 */
export async function loadAllRoutePoints(supabase: ReturnType<typeof createServerClient>): Promise<MapRoutePoint[]> {
  const { data, error } = await supabase
    .from("map_route_points")
    .select("id, latitude, longitude, sort_order, branch_from_id, road_id")
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error("Failed to load route points");
  }

  return (data ?? [])
    .filter((row) => row.id != null && row.latitude != null && row.longitude != null)
    .map((row) => ({
      id: row.id as string,
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      order: Number(row.sort_order ?? 0),
      branchFromId: (row.branch_from_id as string | null) ?? null,
      roadId: (row.road_id as string | null) ?? null,
    }));
}

export async function loadEditableRoads(supabase: ReturnType<typeof createServerClient>): Promise<EditableRoad[]> {
  const [roadsResult, allPoints] = await Promise.all([
    supabase.from("map_roads").select("id, name, kind, width_meters"),
    loadAllRoutePoints(supabase),
  ]);

  if (roadsResult.error) {
    throw new Error("Failed to load roads");
  }

  const pointsByRoadId = new Map<string, MapRoutePoint[]>();
  for (const point of allPoints) {
    if (!point.roadId) continue;
    const list = pointsByRoadId.get(point.roadId) ?? [];
    list.push(point);
    pointsByRoadId.set(point.roadId, list);
  }

  return (roadsResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? "",
    kind: (row.kind as RoadKind | null) ?? "street",
    widthMeters: Number(row.width_meters ?? 26),
    points: pointsByRoadId.get(row.id as string) ?? [],
  }));
}

/**
 * 緯度経度から最も近い道の id を求める（区画は road_id を持たず、
 * 道の形状への投影で都度導出するため）。どの道からも
 * snapDistanceMeters 以上離れている場合は null を返す。
 */
export function findNearestRoadId(
  point: { lat: number; lng: number },
  roads: EditableRoad[],
  snapDistanceMeters: number
): string | null {
  let bestRoadId: string | null = null;
  let bestDistance = Infinity;

  for (const road of roads) {
    if (road.points.length === 0) continue;
    const projection = projectPointOntoRoute(point, road.points);
    if (projection && projection.distanceMeters < bestDistance) {
      bestDistance = projection.distanceMeters;
      bestRoadId = road.id;
    }
  }

  return bestDistance <= snapDistanceMeters ? bestRoadId : null;
}

/**
 * 道削除時のバリデーション用に、区画1件ずつではなく1回のスキャンで
 * 「区画が乗っている道の id 集合」を求める（O(shops × roads) を1回だけ実行する）。
 */
export function findRoadIdsWithShops(
  shops: EditableShop[],
  roads: EditableRoad[],
  snapDistanceMeters: number
): Set<string> {
  const roadIds = new Set<string>();
  for (const shop of shops) {
    const roadId = findNearestRoadId({ lat: shop.lat, lng: shop.lng }, roads, snapDistanceMeters);
    if (roadId) roadIds.add(roadId);
  }
  return roadIds;
}
