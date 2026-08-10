import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { fetchLandmarksFromDb } from "@/app/(public)/map/services/landmarksDb";
import { fetchMapRouteFromDb } from "@/app/(public)/map/services/mapRouteDb";
import { requireSameOrigin } from "@/lib/security/requestGuards";
import { enforceRateLimit } from "@/lib/security/rateLimit";
import { getRole, isAdmin } from "@/lib/auth/permissions";
import type { Landmark as EditableLandmark } from "@/app/(public)/map/types/landmark";
import type { MapRoad, MapRouteConfig, MapRoutePoint } from "@/app/(public)/map/types/mapRoute";
import {
  createAdminWriteClient,
  loadAllRoutePoints,
  loadEditableRoads,
  loadEditableShops,
  type EditableShop,
} from "../_shared";

type SnapshotSummary = {
  updatedShopCount?: number;
  deletedShopCount?: number;
  upsertLandmarkCount?: number;
  deletedLandmarkCount?: number;
  updatedRoutePointCount?: number;
  routeConfigChanged?: boolean;
  restoreSourceSnapshotId?: string;
};

async function createMapLayoutSnapshot(
  supabase: ReturnType<typeof createServerClient>,
  adminWriteClient: SupabaseClient,
  createdBy: string,
  summary: SnapshotSummary
) {
  const [shops, landmarks, roads, routePoints] = await Promise.all([
    loadEditableShops(supabase),
    fetchLandmarksFromDb(supabase),
    loadEditableRoads(supabase),
    // route_json は road_id を保持するため、fetchMapRouteFromDb（本番用・road_id非対応）
    // ではなく road_id が未設定の点も含めて全件取得する loadAllRoutePoints を使う
    loadAllRoutePoints(supabase),
  ]);
  const mapRoute = await fetchMapRouteFromDb(supabase);

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
