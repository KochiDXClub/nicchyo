import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MapRoute, MapRoutePoint } from "../types/mapRoute";
import {
  getDefaultMapRouteConfig,
  getDefaultMapRoutePoints,
  getEffectiveMapRouteConfig,
  normalizeMapRoutePoints,
} from "../utils/mapRouteGeometry";

type MapRoutePointRow = {
  id: string;
  latitude: number | null;
  longitude: number | null;
  sort_order: number | null;
  branch_from_id: string | null;
  road_id: string | null;
};

type MapRouteConfigRow = {
  key: string;
  road_half_width_meters: number | null;
  snap_distance_meters: number | null;
  visible_distance_meters: number | null;
};

export function getFallbackMapRoute(): MapRoute {
  return {
    points: getDefaultMapRoutePoints(),
    config: getDefaultMapRouteConfig(),
  };
}

export async function fetchMapRouteFromDb(
  supabase: SupabaseClient<Database>
): Promise<MapRoute> {
  const [pointsResult, configResult] = await Promise.all([
    supabase
      .from("map_route_points")
      // road_id: 道ごとに別の線として描くため（mapRouteGeometry.ts の getRouteTopology）
      .select("id, latitude, longitude, sort_order, branch_from_id, road_id")
      .order("sort_order", { ascending: true }),
    supabase
      .from("map_route_configs")
      .select("key, road_half_width_meters, snap_distance_meters, visible_distance_meters")
      .eq("key", "default")
      .maybeSingle(),
  ]);

  if (pointsResult.error || configResult.error) {
    return getFallbackMapRoute();
  }

  const points = normalizeMapRoutePoints(
    ((pointsResult.data ?? []) as MapRoutePointRow[])
      .map((row): MapRoutePoint | null => {
        if (!row.id || row.latitude == null || row.longitude == null) {
          return null;
        }
        return {
          id: row.id,
          lat: Number(row.latitude),
          lng: Number(row.longitude),
          order: Number(row.sort_order ?? 0),
          branchFromId: row.branch_from_id ?? null,
          roadId: row.road_id ?? null,
        };
      })
      .filter((row): row is MapRoutePoint => row !== null)
  );

  const configRow = configResult.data as MapRouteConfigRow | null;
  const config = getEffectiveMapRouteConfig(
    configRow
      ? {
          key: configRow.key,
          roadHalfWidthMeters: Number(
            configRow.road_half_width_meters ?? getDefaultMapRouteConfig().roadHalfWidthMeters
          ),
          snapDistanceMeters: Number(
            configRow.snap_distance_meters ?? getDefaultMapRouteConfig().snapDistanceMeters
          ),
          visibleDistanceMeters: Number(
            configRow.visible_distance_meters ?? getDefaultMapRouteConfig().visibleDistanceMeters
          ),
        }
      : null
  );

  if (points.length < 2) {
    return {
      points: getDefaultMapRoutePoints(),
      config,
    };
  }

  return {
    points,
    config,
  };
}
