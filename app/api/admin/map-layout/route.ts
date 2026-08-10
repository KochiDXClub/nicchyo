import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLandmarksFromDb } from "@/app/(public)/map/services/landmarksDb";
import { fetchMapRouteFromDb } from "@/app/(public)/map/services/mapRouteDb";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import type { Landmark as EditableLandmark } from "@/app/(public)/map/types/landmark";
import type { MapRoad, MapRouteConfig, MapRoutePoint, RoadKind } from "@/app/(public)/map/types/mapRoute";
import { projectPointOntoRoute } from "@/app/(public)/map/utils/mapRouteGeometry";

type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
  position: number;
};

type EditableRoad = MapRoad & {
  points: MapRoutePoint[];
};

type VendorOption = {
  id: string;
  name: string;
};

type SnapshotSummary = {
  updatedShopCount: number;
  deletedShopCount: number;
  upsertLandmarkCount: number;
  deletedLandmarkCount: number;
  updatedRoutePointCount: number;
  routeConfigChanged: boolean;
  updatedRoadCount?: number;
  deletedRoadCount?: number;
  restoreSourceSnapshotId?: string;
};

/**
 * 緯度経度から最も近い道の id を求める（区画は road_id を持たず、
 * 道の形状への投影で都度導出するため）。どの道からも
 * snapDistanceMeters 以上離れている場合は null を返す。
 */
function findNearestRoadId(
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

function validateShopAssignments(shops: EditableShop[]) {
  const vendorByPosition = new Map<number, string>();
  const positionByVendor = new Map<string, number>();

  for (const shop of shops) {
    const vendorId = shop.vendorId?.trim();
    if (!vendorId) continue;

    const existingVendor = vendorByPosition.get(shop.position);
    if (existingVendor && existingVendor !== vendorId) {
      return `店番 ${shop.position} に複数の店舗を配置できません`;
    }
    vendorByPosition.set(shop.position, vendorId);

    const existingPosition = positionByVendor.get(vendorId);
    if (existingPosition != null && existingPosition !== shop.position) {
      return "同じ店舗を複数の店番に配置できません";
    }
    positionByVendor.set(vendorId, shop.position);
  }

  return null;
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
  // route_json は road_id を保持するため、fetchMapRouteFromDb（本番用・road_id非対応）
  // ではなく loadEditableRoads から組み立てた点群を使う
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

    const [editableShops, landmarks, mapRoute, roads, vendorsResult] = await Promise.all([
      loadEditableShops(supabase),
      fetchLandmarksFromDb(supabase),
      fetchMapRouteFromDb(supabase),
      loadEditableRoads(supabase),
      supabase.from("vendors").select("id, shop_name").order("shop_name", { ascending: true }),
    ]);

    if (vendorsResult.error) {
      return NextResponse.json({ error: "Failed to load vendor options" }, { status: 500 });
    }

    const vendors: VendorOption[] = (vendorsResult.data ?? []).map((row) => ({
      id: row.id as string,
      name: ((row.shop_name as string | null) || "名称未設定").trim(),
    }));

    return NextResponse.json({ shops: editableShops, landmarks, route: mapRoute, roads, vendors });
  } catch {
    return NextResponse.json({ error: "Failed to load map layout" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const originCheck = requireSameOrigin(request);
    if (!originCheck.ok) return originCheck.response;

    const rateLimited = await enforceRateLimit(request, {
      bucket: "admin-map-layout-put",
      limit: 20,
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

    const body = (await request.json()) as {
      shops?: {
        updated?: EditableShop[];
        deletedLocationIds?: string[];
      };
      landmarks?: {
        upsert?: EditableLandmark[];
        deletedKeys?: string[];
      };
      route?: {
        points?: MapRoutePoint[];
        config?: MapRouteConfig;
      };
      // 道の一覧全体（フル置換）。未指定の場合は道を一切変更しない
      // （新エディタが導入されるまでの後方互換）
      roads?: MapRoad[];
    };

    if (
      !body.shops ||
      !body.landmarks ||
      !body.route ||
      !Array.isArray(body.shops.updated) ||
      !Array.isArray(body.shops.deletedLocationIds) ||
      !Array.isArray(body.landmarks.upsert) ||
      !Array.isArray(body.landmarks.deletedKeys) ||
      !Array.isArray(body.route.points) ||
      !body.route.config ||
      (body.roads !== undefined && !Array.isArray(body.roads))
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const assignmentValidationError = validateShopAssignments(body.shops.updated);
    if (assignmentValidationError) {
      return NextResponse.json({ error: assignmentValidationError }, { status: 400 });
    }

    // 区画が乗っている道は削除できない（クライアント側の制約とサーバー側でも二重に検証）
    let removedRoadIds: string[] = [];
    let existingRoadsForValidation: EditableRoad[] = [];
    if (body.roads) {
      existingRoadsForValidation = await loadEditableRoads(supabase);
      const nextRoadIds = new Set(body.roads.map((road) => road.id));
      const roadsToRemove = existingRoadsForValidation.filter((road) => !nextRoadIds.has(road.id));

      if (roadsToRemove.length > 0) {
        const currentShops = await loadEditableShops(supabase);
        const deletedLocationIdSet = new Set(body.shops.deletedLocationIds);
        const remainingShops = currentShops.filter((shop) => !deletedLocationIdSet.has(shop.locationId));
        const snapDistanceMeters = body.route.config.snapDistanceMeters || 18;

        for (const road of roadsToRemove) {
          const hasShop = remainingShops.some(
            (shop) =>
              findNearestRoadId({ lat: shop.lat, lng: shop.lng }, existingRoadsForValidation, snapDistanceMeters) ===
              road.id
          );
          if (hasShop) {
            return NextResponse.json(
              { error: `${road.name || "選択した道"} には区画があるため削除できません` },
              { status: 400 }
            );
          }
        }
      }

      removedRoadIds = roadsToRemove.map((road) => road.id);
    }

    const hasChanges =
      body.shops.updated.length > 0 ||
      body.shops.deletedLocationIds.length > 0 ||
      body.landmarks.upsert.length > 0 ||
      body.landmarks.deletedKeys.length > 0 ||
      body.route.points.length > 0 ||
      Boolean(body.roads);

    if (hasChanges) {
      await createMapLayoutSnapshot(supabase, adminWriteClient, user.id, {
        updatedShopCount: body.shops.updated.length,
        deletedShopCount: body.shops.deletedLocationIds.length,
        upsertLandmarkCount: body.landmarks.upsert.length,
        deletedLandmarkCount: body.landmarks.deletedKeys.length,
        updatedRoutePointCount: body.route.points.length,
        routeConfigChanged: Boolean(body.route.config),
        updatedRoadCount: body.roads?.length,
        deletedRoadCount: removedRoadIds.length || undefined,
      });
    }

    if (body.shops.updated.length > 0) {
      const createdShops = body.shops.updated.filter((shop) => shop.locationId.startsWith("new-"));
      const existingShops = body.shops.updated.filter((shop) => !shop.locationId.startsWith("new-"));

      if (existingShops.length > 0) {
        const { error } = await adminWriteClient
          .from("market_locations")
          .upsert(
            existingShops.map((shop) => ({
              id: shop.locationId,
              latitude: shop.lat,
              longitude: shop.lng,
              store_number: shop.position,
            })),
            { onConflict: "id" }
          );

        if (error) {
          return NextResponse.json({ error: "Failed to update shop locations" }, { status: 500 });
        }
      }

      const createdLocationIdByPosition = new Map<number, string>();
      if (createdShops.length > 0) {
        const { data, error } = await adminWriteClient
          .from("market_locations")
          .insert(
            createdShops.map((shop) => ({
              latitude: shop.lat,
              longitude: shop.lng,
              store_number: shop.position,
            }))
          )
          .select("id, store_number");

        if (error) {
          return NextResponse.json({ error: "Failed to create shop locations" }, { status: 500 });
        }

        for (const row of data ?? []) {
          if (row.id && row.store_number != null) {
            createdLocationIdByPosition.set(Number(row.store_number), row.id as string);
          }
        }
      }

      const assignmentTargets = body.shops.updated.map((shop) => ({
        ...shop,
        locationId: shop.locationId.startsWith("new-")
          ? createdLocationIdByPosition.get(shop.position) ?? shop.locationId
          : shop.locationId,
      }));

      const affectedLocationIds = assignmentTargets
        .map((shop) => shop.locationId)
        .filter((locationId) => !locationId.startsWith("new-"));
      const affectedVendorIds = assignmentTargets
        .map((shop) => shop.vendorId)
        .filter((vendorId): vendorId is string => Boolean(vendorId));

      if (affectedLocationIds.length > 0) {
        const { error } = await adminWriteClient
          .from("location_assignments")
          .delete()
          .in("location_id", affectedLocationIds);

        if (error) {
          return NextResponse.json({ error: "Failed to clear location assignments" }, { status: 500 });
        }
      }

      if (affectedVendorIds.length > 0) {
        const { error } = await adminWriteClient
          .from("location_assignments")
          .delete()
          .in("vendor_id", affectedVendorIds);

        if (error) {
          return NextResponse.json({ error: "Failed to clear vendor assignments" }, { status: 500 });
        }
      }

      const assignmentsToInsert = assignmentTargets
        .filter((shop) => shop.vendorId && !shop.locationId.startsWith("new-"))
        .map((shop) => ({
          location_id: shop.locationId,
          vendor_id: shop.vendorId as string,
          market_date: new Date().toISOString().slice(0, 10),
        }));

      if (assignmentsToInsert.length > 0) {
        const { error } = await adminWriteClient.from("location_assignments").insert(assignmentsToInsert);

        if (error) {
          return NextResponse.json({ error: "Failed to save shop assignments" }, { status: 500 });
        }
      }
    }

    if (body.shops.deletedLocationIds.length > 0) {
      const { error } = await adminWriteClient
        .from("market_locations")
        .delete()
        .in("id", body.shops.deletedLocationIds);

      if (error) {
        return NextResponse.json({ error: "Failed to delete shop locations" }, { status: 500 });
      }
    }

    if (body.landmarks.deletedKeys.length > 0) {
      const { error } = await adminWriteClient
        .from("map_landmarks")
        .delete()
        .in("key", body.landmarks.deletedKeys);

      if (error) {
        return NextResponse.json({ error: "Failed to delete landmarks" }, { status: 500 });
      }
    }

    if (body.landmarks.upsert.length > 0) {
      const { error: landmarksError } = await adminWriteClient.from("map_landmarks").upsert(
        body.landmarks.upsert.map((landmark) => ({
          key: landmark.key,
          name: landmark.name,
          description: landmark.description,
          image_url: landmark.url,
          latitude: landmark.lat,
          longitude: landmark.lng,
          width_px: landmark.widthPx,
          height_px: landmark.heightPx,
          show_at_min_zoom: landmark.showAtMinZoom,
        })),
        { onConflict: "key" }
      );

      if (landmarksError) {
        return NextResponse.json({ error: "Failed to save landmarks" }, { status: 500 });
      }
    }

    // 道（map_roads）は route_points が road_id で参照するため、
    // ポイントの全置換（replace_map_route_points）より先に upsert しておく
    if (body.roads && body.roads.length > 0) {
      const { error: roadsUpsertError } = await adminWriteClient.from("map_roads").upsert(
        body.roads.map((road) => ({
          id: road.id,
          name: road.name,
          kind: road.kind,
          width_meters: road.widthMeters,
        })),
        { onConflict: "id" }
      );

      if (roadsUpsertError) {
        return NextResponse.json({ error: "Failed to save roads" }, { status: 500 });
      }
    }

    // replace_map_route_points SQL 関数で全件削除→再挿入をアトミックに実行
    // （別々の操作にすると削除後に insert が失敗した場合に route_points が消える）
    const routePointsPayload = body.route.points.map((point, index) => ({
      id: point.id,
      latitude: point.lat,
      longitude: point.lng,
      sort_order: index,
      branch_from_id: point.branchFromId ?? null,
      road_id: point.roadId ?? null,
    }));

    const { error: routePointsError } = await adminWriteClient.rpc(
      "replace_map_route_points",
      { p_points: routePointsPayload }
    );

    if (routePointsError) {
      return NextResponse.json({ error: "Failed to save route points" }, { status: 500 });
    }

    // 参照する route_points がなくなった後で、除外された道を削除する
    if (removedRoadIds.length > 0) {
      const { error: roadsDeleteError } = await adminWriteClient
        .from("map_roads")
        .delete()
        .in("id", removedRoadIds);

      if (roadsDeleteError) {
        return NextResponse.json({ error: "Failed to delete roads" }, { status: 500 });
      }
    }

    const { error: routeConfigError } = await adminWriteClient.from("map_route_configs").upsert(
      {
        key: body.route.config.key,
        road_half_width_meters: body.route.config.roadHalfWidthMeters,
        snap_distance_meters: body.route.config.snapDistanceMeters,
        visible_distance_meters: body.route.config.visibleDistanceMeters,
      },
      { onConflict: "key" }
    );

    if (routeConfigError) {
      return NextResponse.json({ error: "Failed to save route config" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save map layout" }, { status: 500 });
  }
}
