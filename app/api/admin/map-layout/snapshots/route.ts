import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLandmarksFromDb } from "@/app/(public)/map/services/landmarksDb";
import { fetchMapRouteFromDb } from "@/app/(public)/map/services/mapRouteDb";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import type { Landmark as EditableLandmark } from "@/app/(public)/map/types/landmark";
import type { MapRoad, MapRouteConfig, MapRoutePoint, RoadKind } from "@/app/(public)/map/types/mapRoute";

type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
};

type SnapshotSummary = {
  updatedShopCount?: number;
  deletedShopCount?: number;
  upsertLandmarkCount?: number;
  deletedLandmarkCount?: number;
  updatedRoutePointCount?: number;
  routeConfigChanged?: boolean;
  restoreSourceSnapshotId?: string;
};

function createAdminWriteClient(): SupabaseClient {
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

async function loadEditableShops(supabase: ReturnType<typeof createServerClient>): Promise<EditableShop[]> {
  const [assignmentsResult, locationsResult, vendorsResult] = await Promise.all([
    supabase.from("location_assignments").select("vendor_id, location_id, market_date"),
    supabase.from("market_locations").select("id, store_number, latitude, longitude"),
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
        },
      ];
    })
    .sort((a, b) => a.position - b.position);
}

type EditableRoad = MapRoad & {
  points: MapRoutePoint[];
};

async function loadEditableRoads(supabase: ReturnType<typeof createServerClient>): Promise<EditableRoad[]> {
  const [roadsResult, pointsResult] = await Promise.all([
    supabase.from("map_roads").select("id, name, kind, width_meters"),
    supabase
      .from("map_route_points")
      .select("id, latitude, longitude, sort_order, branch_from_id, road_id")
      .order("sort_order", { ascending: true }),
  ]);

  if (roadsResult.error || pointsResult.error) {
    throw new Error("Failed to load roads");
  }

  const pointsByRoadId = new Map<string, MapRoutePoint[]>();
  for (const row of pointsResult.data ?? []) {
    const roadId = row.road_id as string | null;
    if (!roadId || row.id == null || row.latitude == null || row.longitude == null) continue;
    const list = pointsByRoadId.get(roadId) ?? [];
    list.push({
      id: row.id as string,
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      order: Number(row.sort_order ?? 0),
      branchFromId: (row.branch_from_id as string | null) ?? null,
      roadId,
    });
    pointsByRoadId.set(roadId, list);
  }

  return (roadsResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string | null) ?? "",
    kind: (row.kind as RoadKind | null) ?? "street",
    widthMeters: Number(row.width_meters ?? 26),
    points: pointsByRoadId.get(row.id as string) ?? [],
  }));
}

async function createMapLayoutSnapshot(
  supabase: ReturnType<typeof createServerClient>,
  adminWriteClient: SupabaseClient,
  createdBy: string,
  summary: SnapshotSummary
) {
  const [shops, landmarks, roads] = await Promise.all([
    loadEditableShops(supabase),
    fetchLandmarksFromDb(supabase),
    loadEditableRoads(supabase),
  ]);
  const mapRoute = await fetchMapRouteFromDb(supabase);
  const routePoints = roads.flatMap((road) => road.points);

  const { error } = await adminWriteClient.from("map_layout_snapshots").insert({
    shops_json: shops,
    landmarks_json: landmarks,
    route_json: routePoints,
    route_config_json: mapRoute.config,
    roads_json: roads.map(({ points: _points, ...road }) => road),
    created_by: createdBy,
    summary,
  });

  if (error) {
    throw new Error("Failed to create map layout snapshot");
  }
}

async function applySnapshot(
  adminWriteClient: SupabaseClient,
  snapshotShops: EditableShop[],
  snapshotLandmarks: EditableLandmark[],
  snapshotRoutePoints: MapRoutePoint[],
  snapshotRouteConfig: MapRouteConfig | null,
  snapshotRoads: MapRoad[]
) {
  // restore_map_layout_snapshot SQL 関数で全テーブルの復元を1トランザクションに閉じる
  const { error } = await adminWriteClient.rpc("restore_map_layout_snapshot", {
    p_shops: snapshotShops,
    p_landmarks: snapshotLandmarks,
    p_route_points: snapshotRoutePoints,
    p_route_config: snapshotRouteConfig ?? null,
    p_roads: snapshotRoads,
  });

  if (error) {
    throw new Error(`Failed to restore map layout: ${error.message}`);
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(getRole(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminWriteClient = createAdminWriteClient();
    const { data, error } = await adminWriteClient
      .from("map_layout_snapshots")
      .select("id, created_at, created_by, summary")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      return NextResponse.json({ error: "Failed to load snapshots" }, { status: 500 });
    }

    return NextResponse.json({ snapshots: data ?? [] });
  } catch {
    return NextResponse.json({ error: "Failed to load snapshots" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-map-layout-snapshots-post",
      limit: 12,
      windowMs: 10 * 60 * 1000,
    });
    if (rateLimited) return rateLimited;

    const cookieStore = await cookies();
    const supabase = createServerClient(cookieStore);
    const adminWriteClient = createAdminWriteClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !isAdmin(getRole(user))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { snapshotId?: string };
    if (!body.snapshotId) {
      return NextResponse.json({ error: "snapshotId is required" }, { status: 400 });
    }

    const { data, error } = await adminWriteClient
      .from("map_layout_snapshots")
      .select("id, shops_json, landmarks_json, route_json, route_config_json, roads_json")
      .eq("id", body.snapshotId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
    }

    const snapshotShops = Array.isArray(data.shops_json) ? (data.shops_json as EditableShop[]) : [];
    const snapshotLandmarks = Array.isArray(data.landmarks_json)
      ? (data.landmarks_json as EditableLandmark[])
      : [];
    const snapshotRoutePoints = Array.isArray(data.route_json)
      ? (data.route_json as MapRoutePoint[])
      : [];
    const snapshotRouteConfig =
      data.route_config_json && typeof data.route_config_json === "object"
        ? (data.route_config_json as MapRouteConfig)
        : null;
    const snapshotRoads = Array.isArray(data.roads_json) ? (data.roads_json as MapRoad[]) : [];

    await createMapLayoutSnapshot(supabase, adminWriteClient, user.id, {
      restoreSourceSnapshotId: body.snapshotId,
    });
    await applySnapshot(
      adminWriteClient,
      snapshotShops,
      snapshotLandmarks,
      snapshotRoutePoints,
      snapshotRouteConfig,
      snapshotRoads
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to restore snapshot" }, { status: 500 });
  }
}
