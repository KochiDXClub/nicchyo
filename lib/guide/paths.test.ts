import { describe, expect, it } from 'vitest';
import type { MapRoute } from '@/app/(public)/map/types/mapRoute';
import { getDefaultMapRouteConfig, getDefaultMapRoutePoints } from '@/app/(public)/map/utils/mapRouteGeometry';
import { buildGuideNetwork } from './network';
import { buildGuidePaths, buildGuidePathsFromMapRoute, GUIDE_CONNECTOR_PATHS, MARKET_PATH_NAME } from './paths';
import { findGuideRoute } from './routing';

const defaultRoute: MapRoute = { points: getDefaultMapRoutePoints(), config: getDefaultMapRouteConfig() };

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
    const paths = buildGuidePathsFromMapRoute(route, [
      { id: 'road-a', name: '中央公園への道', kind: 'path', widthMeters: 4 },
    ]);
    const branch = paths.find((p) => p.name === '中央公園への道');
    expect(branch).toBeDefined();
    expect(branch!.kind).toBe('path');
    expect(branch!.points).toHaveLength(2);
  });
});

describe('buildGuidePaths（接続路つき）', () => {
  it('DB に同じ名前の道があれば静的な接続路は使わない', () => {
    const main = getDefaultMapRoutePoints();
    const anchor = main[Math.floor(main.length / 2)];
    const route: MapRoute = {
      ...defaultRoute,
      points: [
        ...main,
        { id: 'branch-1', lat: anchor.lat - 0.0005, lng: anchor.lng, order: main.length, branchFromId: anchor.id, roadId: 'road-a' },
      ],
    };
    const paths = buildGuidePaths(route, [{ id: 'road-a', name: '中央公園への道', kind: 'path', widthMeters: 4 }]);
    expect(paths.filter((p) => p.name === '中央公園への道')).toHaveLength(1);
    expect(paths.find((p) => p.name === '中央公園への道')!.verified).toBe(true);
    // 枝の分岐点で本線が2本に分かれる（追手筋 ×2 + 枝1）+ 名前が重ならない接続路
    const fromMap = paths.filter((p) => p.verified);
    expect(fromMap.filter((p) => p.name === MARKET_PATH_NAME).length).toBeGreaterThanOrEqual(1);
    expect(paths.length).toBe(fromMap.length + GUIDE_CONNECTOR_PATHS.length - 1);
  });

  it('接続路は追手筋につながり、会場内から電停・アーケードまで道なりの経路が引ける', () => {
    const network = buildGuideNetwork(buildGuidePaths(defaultRoute));
    // 会場の東寄りから、はりまや橋停留場へ
    const toHarimaya = findGuideRoute(
      { lat: 33.5621, lng: 133.541 },
      { lat: 33.5596333, lng: 133.5423972 },
      network,
      { destinationName: 'はりまや橋停留場' }
    );
    expect(toHarimaya.viaNetwork).toBe(true);
    expect(toHarimaya.steps.map((s) => s.instruction).join(' ')).toContain('はりまや橋方面の通り');

    // 会場の西寄りから、帯屋町アーケード（中ほど）へ
    const toArcade = findGuideRoute(
      { lat: 33.5608, lng: 133.535 },
      { lat: 33.5601, lng: 133.5372 },
      network,
      { destinationName: '帯屋町アーケード' }
    );
    expect(toArcade.viaNetwork).toBe(true);
    expect(toArcade.approximate).toBe(true);

    // 会場の東端から JR高知駅へ
    const toStation = findGuideRoute(
      { lat: 33.5622, lng: 133.5425 },
      { lat: 33.567691786705, lng: 133.5436611 },
      network,
      { destinationName: '高知駅' }
    );
    expect(toStation.viaNetwork).toBe(true);
    expect(toStation.distanceMeters).toBeGreaterThan(500);
  });
});
