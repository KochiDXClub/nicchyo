/**
 * 案内に使う道（GuidePath）とネットワークの組み立て
 *
 *   - 歩行者ネットワーク: OpenStreetMap 由来の実際の道路網
 *     （lib/guide/data/kochi-walk-network.json）。経路は必ずこの道の上を通る
 *   - 会場の道: マップの道データ（map_route_points / map_roads）。
 *     本線＝追手筋、枝＝横道として取り出し、歩行者ネットワークに足す
 */

import type { MapRoad, MapRoute } from '@/app/(public)/map/types/mapRoute';
import { getRouteChains } from '@/app/(public)/map/utils/mapRouteGeometry';
import type { GuideNetwork, GuidePath } from './types';
import { buildGuideNetwork } from './network';
import { buildWalkNetwork, type WalkNetworkData } from './walkNetwork';

export const MARKET_PATH_NAME = '追手筋';

/**
 * マップの道データから GuidePath を作る。
 * 本線（枝でない点の並び）が追手筋、枝は map_roads の名前（無ければ「横道」）。
 */
export function buildGuidePathsFromMapRoute(mapRoute: MapRoute, roads: MapRoad[] = []): GuidePath[] {
  const roadById = new Map(roads.map((road) => [road.id, road]));
  const chains = getRouteChains(mapRoute.points);
  const paths: GuidePath[] = [];

  chains.forEach((chain, index) => {
    if (chain.points.length < 2) return;
    const isMain = chain.points.every((point) => !point.branchFromId);
    const road = chain.points.map((point) => (point.roadId ? roadById.get(point.roadId) : undefined)).find(Boolean);
    paths.push({
      id: `route-${chain.key || index}`,
      name: isMain ? MARKET_PATH_NAME : road?.name ?? '横道',
      kind: isMain ? 'market' : road?.kind ?? 'street',
      verified: true,
      points: chain.points.map((point) => ({ lat: point.lat, lng: point.lng })),
    });
  });

  return paths;
}

/** 会場の道（DB）だけで組む。歩行者ネットワークが読めないときの最小構成 */
export function buildGuidePaths(mapRoute: MapRoute, roads: MapRoad[] = []): GuidePath[] {
  return buildGuidePathsFromMapRoute(mapRoute, roads);
}

/**
 * 案内用のネットワーク。歩行者ネットワーク（OSM）を土台に、会場の道（DB）を足す。
 * 歩行者ネットワークが無ければ会場の道だけで組む（経路は追手筋沿いに限られる）。
 */
export function buildGuideNetworkForMap(
  walkData: WalkNetworkData | null,
  mapRoute: MapRoute | null,
  roads: MapRoad[] = []
): GuideNetwork | null {
  const mapPaths = mapRoute ? buildGuidePathsFromMapRoute(mapRoute, roads) : [];
  if (walkData) return buildWalkNetwork(walkData, mapPaths);
  if (mapPaths.length === 0) return null;
  // buildGuideNetwork は端点の近さで交差点を推定する簡易版
  return buildGuideNetwork(mapPaths);
}
