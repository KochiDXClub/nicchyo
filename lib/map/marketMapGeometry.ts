import { containsRouteBounds, resolveMapViewBounds, type MapViewSettings } from "./mapViewSettings";
import type { MapRoute, MapRoutePoint } from "@/app/(public)/map/types/mapRoute";
import { getRouteBounds } from "@/app/(public)/map/utils/mapRouteGeometry";

export function scopePublicMapRoute(route: MapRoute, marketIds: ReadonlySet<string>, sundayMarketId?: string): MapRoute {
  const roads = route.roads?.filter((road) => road.marketId && marketIds.has(road.marketId));
  const marketByRoad = new Map(roads?.map((road) => [road.id, road.marketId]));
  const marketOf = (point: MapRoutePoint) => point.roadId ? marketByRoad.get(point.roadId) : sundayMarketId;
  const points = route.points.filter(marketOf);
  const marketByPoint = new Map(points.map((point) => [point.id, marketOf(point)]));
  return {
    ...route,
    roads,
    // 非公開の市からの枝や、別の市との接続を公開地図の線に使わない。
    points: points.map((point) => point.branchFromId && marketByPoint.get(point.branchFromId) !== marketOf(point)
      ? { ...point, branchFromId: null }
      : point),
  };
}

/** 新しい市場では登録済みの道だけを使う。道の未登録時は地図全体の画角へ戻す。 */
export function getMarketMapGeometry(
  points: MapRoutePoint[],
  roads: MapRoute["roads"],
  initialMarketId?: string,
  sundayMarketId?: string,
) {
  const marketByRoad = new Map(roads?.map((road) => [road.id, road.marketId]));
  const markets = new Set<string>();
  const selected: MapRoutePoint[] = [];
  for (const point of points) {
    const marketId = point.roadId ? marketByRoad.get(point.roadId) : sundayMarketId;
    if (!marketId) continue;
    markets.add(marketId);
    if (marketId === initialMarketId) selected.push(point);
  }
  return {
    initialPoints: selected.length >= 2 ? selected : points,
    ensureMarketBounds: markets.size > 1 || (initialMarketId !== undefined && initialMarketId !== sundayMarketId),
  };
}

export function resolveMarketMapBounds(points: MapRoutePoint[], settings: MapViewSettings, ensureMarketBounds: boolean) {
  const routeBounds = getRouteBounds(points);
  // 従来の日曜市用の手動枠で、別の市へ移動できなくなることを防ぐ。
  if (ensureMarketBounds && settings.mode === "manual" && settings.bounds && !containsRouteBounds(settings.bounds, routeBounds)) {
    return resolveMapViewBounds({ ...settings, mode: "auto" }, routeBounds);
  }
  return resolveMapViewBounds(settings, routeBounds);
}
