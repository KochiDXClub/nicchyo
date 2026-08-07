/**
 * おでかけサポートの道すじが、実際の追手筋センターラインに沿うことを確かめる。
 * lib 側の単体テストはダミーの通りを使うため、ここでは本番の座標で検証する。
 */

import { describe, expect, it } from 'vitest';
import { getNearestPointOnRoad, getRoadCenterlinePoints } from '../config/roadConfig';
import { FACILITIES } from '@/lib/facilities/facilities';
import { distanceInMeters } from '@/lib/facilities/geo';
import { findNearestFacility } from '@/lib/facilities/nearest';
import { buildRouteAlongRoad } from '@/lib/facilities/route';

const centerline = getRoadCenterlinePoints();

/** 追手筋の東寄り（会場内）に立っている想定 */
const originEast = { lat: 33.5621, lng: 133.5410 };

describe('追手筋に沿った道すじ', () => {
  it('センターラインは複数点を持つ', () => {
    expect(centerline.length).toBeGreaterThan(2);
  });

  it('会場内から西の施設へ向かうと、通り上の点を経由する', () => {
    const kochiCastle = FACILITIES.find((f) => f.id === 'restroom-kochi-castle');
    expect(kochiCastle).toBeDefined();

    const route = buildRouteAlongRoad(originEast, kochiCastle!, centerline);

    // 端点を除いた中間点は、すべて追手筋のごく近くにある
    const middle = route.points.slice(1, -1);
    expect(middle.length).toBeGreaterThan(0);

    for (const point of middle) {
      const onRoad = getNearestPointOnRoad(point.lat, point.lng);
      expect(distanceInMeters(point, onRoad)).toBeLessThan(5);
    }
  });

  it('道なりの距離は直線距離より長い', () => {
    const kochiCastle = FACILITIES.find((f) => f.id === 'restroom-kochi-castle')!;
    const route = buildRouteAlongRoad(originEast, kochiCastle, centerline);
    expect(route.distanceMeters).toBeGreaterThan(distanceInMeters(originEast, kochiCastle));
  });

  it('会場内から最寄りのお手洗いを選ぶと、道すじつきで返る', () => {
    const nearest = findNearestFacility(originEast, 'restroom', FACILITIES, centerline);

    expect(nearest).not.toBeNull();
    expect(nearest!.route.points.length).toBeGreaterThanOrEqual(2);
    expect(nearest!.walkMinutes).toBeGreaterThan(0);
    // 道すじの始点は現在地、終点は施設
    expect(nearest!.route.points[0]).toEqual(originEast);
    const last = nearest!.route.points[nearest!.route.points.length - 1];
    expect(last.lat).toBeCloseTo(nearest!.facility.lat, 6);
    expect(last.lng).toBeCloseTo(nearest!.facility.lng, 6);
  });

  it('カテゴリごとに最寄りが見つかる', () => {
    for (const category of ['restroom', 'rest', 'transport'] as const) {
      const nearest = findNearestFacility(originEast, category, FACILITIES, centerline);
      expect(nearest, category).not.toBeNull();
    }
  });
});
