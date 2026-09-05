/**
 * 案内に使う道（GuidePath）の組み立て
 *
 *   - 会場の道: マップの道データ（map_route_points / map_roads）から。
 *     本線＝追手筋、枝＝横道として取り出す
 *   - 会場の外へ出る道: 静的な接続路（GUIDE_CONNECTOR_PATHS）。
 *     帯屋町アーケード・はりまや橋方面・高知城前・中央公園・ひろめ市場・JR高知駅へ
 *     つながる数本を、追手筋のすぐそばに端点を置いて定義してある
 *
 * ⚠️ 接続路の座標は地図から読み取った暫定値（verified: false）。案内文には
 *    「おおよそ」と添える。管理画面のマップ編集で同名の道（kind: street / path）を
 *    引けば、DB 側の道が優先され、こちらは使われなくなる。
 */

import type { MapRoad, MapRoute } from '@/app/(public)/map/types/mapRoute';
import { getRouteChains } from '@/app/(public)/map/utils/mapRouteGeometry';
import { projectOntoPolyline } from '@/lib/facilities/route';
import type { GuidePath, LatLng } from './types';

/** 接続路の端点がこの距離以内に追手筋があれば、端点を追手筋の上へ寄せてつなぐ */
export const CONNECTOR_SNAP_METERS = 60;

export const MARKET_PATH_NAME = '追手筋';

/** 会場の外へつなぐ静的な接続路（暫定座標） */
export const GUIDE_CONNECTOR_PATHS: GuidePath[] = [
  {
    id: 'connector-central-park',
    name: '中央公園への道',
    kind: 'path',
    verified: false,
    points: [
      { lat: 33.5614, lng: 133.5378 },
      { lat: 33.561, lng: 133.5378 },
    ],
  },
  {
    id: 'connector-central-park-arcade',
    name: '中央公園からアーケードへの道',
    kind: 'path',
    verified: false,
    points: [
      { lat: 33.561, lng: 133.5378 },
      { lat: 33.5601, lng: 133.5375 },
    ],
  },
  {
    id: 'connector-obiyamachi-arcade',
    name: '帯屋町アーケード',
    kind: 'path',
    verified: false,
    points: [
      { lat: 33.56005, lng: 133.5342 },
      { lat: 33.5601, lng: 133.5372 },
      { lat: 33.56005, lng: 133.541 },
    ],
  },
  {
    id: 'connector-hirome',
    name: 'ひろめ市場への道',
    kind: 'path',
    verified: false,
    points: [
      { lat: 33.5608, lng: 133.5347 },
      { lat: 33.5598, lng: 133.5346 },
    ],
  },
  {
    id: 'connector-hirome-arcade',
    name: 'ひろめ市場からアーケードへの道',
    kind: 'path',
    verified: false,
    points: [
      { lat: 33.5598, lng: 133.5346 },
      { lat: 33.56005, lng: 133.5342 },
    ],
  },
  {
    id: 'connector-castle-street',
    name: '高知城前の通り',
    kind: 'street',
    verified: false,
    points: [
      { lat: 33.56047, lng: 133.5337 },
      { lat: 33.5585, lng: 133.5339 },
    ],
  },
  {
    id: 'connector-harimaya-street',
    name: 'はりまや橋方面の通り',
    kind: 'street',
    verified: false,
    points: [
      { lat: 33.56231, lng: 133.5433 },
      { lat: 33.5605, lng: 133.543 },
      { lat: 33.5597, lng: 133.5426 },
      { lat: 33.5596333, lng: 133.5423972 },
    ],
  },
  {
    id: 'connector-arcade-east',
    name: 'アーケード東口からはりまや橋方面の通りへの道',
    kind: 'path',
    verified: false,
    points: [
      { lat: 33.56005, lng: 133.541 },
      { lat: 33.5601, lng: 133.5429 },
    ],
  },
  {
    id: 'connector-ekimae-street',
    name: '駅前の通り（追手筋〜高知駅）',
    kind: 'street',
    verified: false,
    points: [
      { lat: 33.56231, lng: 133.5433 },
      { lat: 33.5640, lng: 133.5435 },
      { lat: 33.5668361, lng: 133.5436528 },
      { lat: 33.567691786705, lng: 133.5436611 },
    ],
  },
];

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

/**
 * 接続路の両端が追手筋（会場の道）のすぐそばなら、端点を追手筋の上に寄せる。
 * 接続路の座標は暫定値なので、そのままだと追手筋に届かず交差点ができないことがある。
 */
function snapConnectorToMarket(connector: GuidePath, marketPaths: GuidePath[]): GuidePath {
  const snap = (point: LatLng): LatLng => {
    let best: { point: LatLng; distance: number } | null = null;
    for (const market of marketPaths) {
      const projection = projectOntoPolyline(point, market.points);
      if (projection && (!best || projection.distanceMeters < best.distance)) {
        best = { point: projection.point, distance: projection.distanceMeters };
      }
    }
    return best && best.distance <= CONNECTOR_SNAP_METERS ? best.point : point;
  };
  const points = connector.points.map((point, index) =>
    index === 0 || index === connector.points.length - 1 ? snap(point) : point
  );
  return { ...connector, points };
}

/**
 * 会場の道 + 接続路。DB に同じ名前の道があれば接続路のほうは使わない
 * （管理画面で実測の道を引いたら、そちらへ自然に置き換わる）。
 */
export function buildGuidePaths(mapRoute: MapRoute, roads: MapRoad[] = []): GuidePath[] {
  const fromMap = buildGuidePathsFromMapRoute(mapRoute, roads);
  const names = new Set(fromMap.map((path) => path.name));
  const marketPaths = fromMap.filter((path) => path.kind === 'market');
  const connectors = GUIDE_CONNECTOR_PATHS.filter((path) => !names.has(path.name)).map((path) =>
    snapConnectorToMarket(path, marketPaths)
  );
  return [...fromMap, ...connectors];
}
