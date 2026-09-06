/**
 * おでかけサポートの道すじが、実際の追手筋センターラインに沿うことを確かめる。
 * lib 側の単体テストはダミーの通りを使うため、ここでは本番の座標で検証する。
 *
 * 施設データは map_landmarks（DB）が情報源なので、ここでは移行前の静的データと
 * 同じ座標を持つ Facility を直接置いて使う。
 */

import { describe, expect, it } from 'vitest';
import { getNearestPointOnRoad, getRoadCenterlinePoints } from '../config/roadConfig';
import type { Facility } from '@/lib/facilities/facilities';
import { distanceInMeters } from '@/lib/facilities/geo';
import { findNearestFacility } from '@/lib/facilities/nearest';
import { buildRouteAlongRoad } from '@/lib/facilities/route';

const centerline = getRoadCenterlinePoints();

/** 追手筋の東寄り（会場内）に立っている想定 */
const originEast = { lat: 33.5621, lng: 133.5410 };

const FACILITIES: Facility[] = [
  {
    id: 'restroom-central-park',
    category: 'restroom',
    name: '中央公園 公衆お手洗い',
    area: '会場の中ほど・中央公園内',
    lat: 33.5609,
    lng: 133.5376,
  },
  {
    id: 'restroom-kochi-castle',
    category: 'restroom',
    name: '高知公園（高知城前）公衆お手洗い',
    area: '会場の西のはし・追手門のそば',
    lat: 33.5607,
    lng: 133.5341,
  },
  {
    id: 'restroom-hirome',
    category: 'restroom',
    name: 'ひろめ市場',
    area: '会場から南へ徒歩3分ほど',
    lat: 33.5598,
    lng: 133.5346,
  },
  {
    id: 'rest-central-park',
    category: 'rest',
    name: '中央公園',
    area: '会場の中ほど・南がわ',
    lat: 33.561,
    lng: 133.5379,
  },
];

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

  it('東寄りに立っていると、最寄りのお手洗いは中央公園になる', () => {
    const nearest = findNearestFacility(originEast, 'restroom', FACILITIES, centerline);
    expect(nearest?.facility.id).toBe('restroom-central-park');
  });

  it('カテゴリに施設が無ければ null', () => {
    expect(findNearestFacility(originEast, 'transport', FACILITIES, centerline)).toBeNull();
  });
});
