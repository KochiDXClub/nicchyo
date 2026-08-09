import { describe, expect, it } from 'vitest';
import { buildRouteAlongRoad, polylineLength, projectOntoPolyline } from './route';

// 東西にまっすぐ伸びる通りを想定したセンターライン
const centerline = [
  { lat: 33.5620, lng: 133.5340 },
  { lat: 33.5620, lng: 133.5390 },
  { lat: 33.5620, lng: 133.5440 },
];

describe('projectOntoPolyline', () => {
  it('通りの北がわの点は、真南の通り上に落ちる', () => {
    const result = projectOntoPolyline({ lat: 33.5625, lng: 133.5360 }, centerline);
    expect(result?.point.lat).toBeCloseTo(33.5620, 6);
    expect(result?.point.lng).toBeCloseTo(133.5360, 6);
    expect(result?.segmentIndex).toBe(0);
  });

  it('通りの端より外の点は端に丸められる', () => {
    const result = projectOntoPolyline({ lat: 33.5620, lng: 133.5300 }, centerline);
    expect(result?.point.lng).toBeCloseTo(133.5340, 6);
    expect(result?.t).toBe(0);
  });

  it('点が1つだけの折れ線でもその点を返す', () => {
    const result = projectOntoPolyline({ lat: 33.56, lng: 133.53 }, [centerline[0]]);
    expect(result?.point).toEqual(centerline[0]);
  });

  it('空の折れ線ならnull', () => {
    expect(projectOntoPolyline({ lat: 33.56, lng: 133.53 }, [])).toBeNull();
  });
});

describe('buildRouteAlongRoad', () => {
  it('通り沿いの2地点は通りを経由してつながる', () => {
    const route = buildRouteAlongRoad(
      { lat: 33.5622, lng: 133.5350 },
      { lat: 33.5618, lng: 133.5430 },
      centerline
    );

    // 現在地 → 通りに出る → 途中の折れ点 → 通りから折れる → 施設
    expect(route.points.length).toBeGreaterThan(3);
    expect(route.points[0]).toEqual({ lat: 33.5622, lng: 133.5350 });
    expect(route.points[route.points.length - 1]).toEqual({ lat: 33.5618, lng: 133.5430 });
    // 通りを迂回するぶん、直線よりは長くなる
    expect(route.distanceMeters).toBeGreaterThan(0);
  });

  it('西から東でも東から西でも同じ区間をたどる', () => {
    const eastward = buildRouteAlongRoad(
      { lat: 33.5622, lng: 133.5350 },
      { lat: 33.5618, lng: 133.5430 },
      centerline
    );
    const westward = buildRouteAlongRoad(
      { lat: 33.5618, lng: 133.5430 },
      { lat: 33.5622, lng: 133.5350 },
      centerline
    );
    expect(westward.distanceMeters).toBeCloseTo(eastward.distanceMeters, 3);
  });

  it('通りを経由すると遠回りになる近距離の組み合わせは直線でつなぐ', () => {
    const route = buildRouteAlongRoad(
      { lat: 33.5700, lng: 133.5390 },
      { lat: 33.5701, lng: 133.5391 },
      centerline
    );
    expect(route.points).toHaveLength(2);
  });

  it('センターラインが足りなければ直線でつなぐ', () => {
    const route = buildRouteAlongRoad(
      { lat: 33.5622, lng: 133.5350 },
      { lat: 33.5618, lng: 133.5430 },
      []
    );
    expect(route.points).toHaveLength(2);
  });
});

describe('polylineLength', () => {
  it('点が1つ以下なら0', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ lat: 33.56, lng: 133.53 }])).toBe(0);
  });

  it('区間の合計になる', () => {
    const length = polylineLength([
      { lat: 33.5620, lng: 133.5340 },
      { lat: 33.5620, lng: 133.5390 },
      { lat: 33.5620, lng: 133.5440 },
    ]);
    expect(length).toBeGreaterThan(800);
    expect(length).toBeLessThan(1000);
  });
});
