import { describe, expect, it } from 'vitest';
import type { MapRoute } from '@/app/(public)/map/types/mapRoute';
import { getDefaultMapRouteConfig, getDefaultMapRoutePoints } from '@/app/(public)/map/utils/mapRouteGeometry';
import walkData from './data/kochi-walk-network.json';
import { buildGuideNetworkForMap, buildGuidePathsFromMapRoute, MARKET_PATH_NAME } from './paths';
import { findGuideRoute } from './routing';
import type { WalkNetworkData } from './walkNetwork';

const defaultRoute: MapRoute = { points: getDefaultMapRoutePoints(), config: getDefaultMapRouteConfig() };
const walk = walkData as WalkNetworkData;

describe('buildGuidePathsFromMapRoute', () => {
  it('本線は追手筋（market・確認済み）になる', () => {
    const paths = buildGuidePathsFromMapRoute(defaultRoute);
    expect(paths).toHaveLength(1);
    expect(paths[0].name).toBe(MARKET_PATH_NAME);
    expect(paths[0].kind).toBe('market');
    expect(paths[0].verified).toBe(true);
    expect(paths[0].points.length).toBeGreaterThan(2);
  });

  it('枝は map_roads の名前と種別を引き継ぐ', () => {
    const main = getDefaultMapRoutePoints();
    const anchor = main[Math.floor(main.length / 2)];
    const route: MapRoute = {
      ...defaultRoute,
      points: [
        ...main,
        { id: 'branch-1', lat: anchor.lat - 0.0005, lng: anchor.lng, order: main.length, branchFromId: anchor.id, roadId: 'road-a' },
      ],
    };
    const paths = buildGuidePathsFromMapRoute(route, [{ id: 'road-a', name: '中央公園への小道', kind: 'path', widthMeters: 4 }]);
    const branch = paths.find((p) => p.name === '中央公園への小道');
    expect(branch).toBeDefined();
    expect(branch!.kind).toBe('path');
    expect(branch!.points).toHaveLength(2);
  });
});

describe('歩行者ネットワーク（OpenStreetMap）', () => {
  it('データは追手筋周辺を覆い、道が交差点で共有ノードによりつながる', () => {
    expect(walk.nodes.length).toBeGreaterThan(1000);
    expect(walk.ways.length).toBeGreaterThan(500);
    expect(walk.ways.some(([name]) => name === '追手筋')).toBe(true);
    const network = buildGuideNetworkForMap(walk, defaultRoute)!;
    // 追手筋の東端付近から はりまや橋停留場へ、道の上を通って到達できる
    const route = findGuideRoute(
      { lat: 33.5621, lng: 133.541 },
      { lat: 33.5596333, lng: 133.5423972 },
      network,
      { destinationName: 'はりまや橋停留場' }
    );
    expect(route.viaNetwork).toBe(true);
    expect(route.approximate).toBe(false);
    expect(route.distanceMeters).toBeGreaterThan(300);
    expect(route.distanceMeters).toBeLessThan(900);
    expect(route.steps.length).toBeGreaterThan(2);
  });

  it('会場の外（JR高知駅）からでも、道なりの経路と距離が出る', () => {
    const network = buildGuideNetworkForMap(walk, defaultRoute)!;
    const route = findGuideRoute(
      { lat: 33.567691786705, lng: 133.5436611 },
      { lat: 33.5614, lng: 133.538 },
      network,
      { destinationName: '日曜市の中ほど' }
    );
    expect(route.viaNetwork).toBe(true);
    expect(route.distanceMeters).toBeGreaterThan(900);
    expect(route.distanceMeters).toBeLessThan(2000);
    // 起点・終点以外の点はすべて道路網のノード上にある
    const nodeSet = new Set(walk.nodes.map(([lat, lng]) => `${lat},${lng}`));
    const onRoad = route.points.slice(2, -2).filter((p) => nodeSet.has(`${p.lat},${p.lng}`));
    expect(onRoad.length).toBeGreaterThanOrEqual(route.points.length - 6);
  });

  it('歩行者ネットワークが無ければ会場の道だけで組み、それも無ければ null', () => {
    expect(buildGuideNetworkForMap(null, defaultRoute)?.paths.length).toBe(1);
    expect(buildGuideNetworkForMap(null, null)).toBeNull();
  });

  it('経路計算は十分に速い（20件の目的地で 1 秒以内）', () => {
    const network = buildGuideNetworkForMap(walk, defaultRoute)!;
    const started = Date.now();
    for (let i = 0; i < 20; i += 1) {
      findGuideRoute({ lat: 33.5614, lng: 133.538 }, { lat: 33.5596 + i * 0.0003, lng: 133.5424 }, network, { destinationName: 'x' });
    }
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
