import { describe, expect, it } from 'vitest';
import type { Facility } from './facilities';
import { distanceInMeters } from './geo';
import {
  DETOUR_RATIO,
  estimateWalkMinutes,
  findNearestFacility,
  formatDistance,
  rankFacilitiesByWalk,
} from './nearest';

const makeFacility = (
  overrides: Partial<Facility> & Pick<Facility, 'id' | 'lat' | 'lng'>
): Facility => ({
  category: 'restroom',
  name: overrides.id,
  area: 'テスト',
  ...overrides,
});

describe('distanceInMeters', () => {
  it('同じ地点なら0を返す', () => {
    expect(distanceInMeters({ lat: 33.5614, lng: 133.5379 }, { lat: 33.5614, lng: 133.5379 })).toBe(0);
  });

  it('緯度0.001度の差はおよそ111m', () => {
    const meters = distanceInMeters({ lat: 33.5614, lng: 133.5379 }, { lat: 33.5624, lng: 133.5379 });
    expect(meters).toBeGreaterThan(105);
    expect(meters).toBeLessThan(117);
  });
});

describe('estimateWalkMinutes', () => {
  it('分速70mで割った値を四捨五入する', () => {
    expect(estimateWalkMinutes(140)).toBe(2);
    expect(estimateWalkMinutes(350)).toBe(5);
  });

  it('ごく近くても0分にはしない', () => {
    expect(estimateWalkMinutes(5)).toBe(1);
    expect(estimateWalkMinutes(0)).toBe(1);
  });
});

describe('findNearestFacility', () => {
  const facilities: Facility[] = [
    makeFacility({ id: 'far', lat: 33.5700, lng: 133.5379 }),
    makeFacility({ id: 'near', lat: 33.5616, lng: 133.5379 }),
    makeFacility({ id: 'nearest-but-other-category', lat: 33.5614, lng: 133.5379, category: 'rest' }),
  ];
  const origin = { lat: 33.5614, lng: 133.5379 };

  it('同じカテゴリのうち最も近い施設を返す', () => {
    const result = findNearestFacility(origin, 'restroom', facilities);
    expect(result?.facility.id).toBe('near');
  });

  it('カテゴリが違う施設は選ばない', () => {
    const result = findNearestFacility(origin, 'restroom', facilities);
    expect(result?.facility.id).not.toBe('nearest-but-other-category');
  });

  it('センターラインが無いときは直線距離に迂回係数をかける', () => {
    const result = findNearestFacility(origin, 'restroom', facilities);
    const straight = distanceInMeters(origin, { lat: 33.5616, lng: 133.5379 });
    expect(result?.walkDistanceMeters).toBeCloseTo(straight * DETOUR_RATIO, 5);
  });

  it('センターラインが無いときの道すじは現在地と施設を直線で結ぶ', () => {
    const result = findNearestFacility(origin, 'restroom', facilities);
    expect(result?.route.points).toHaveLength(2);
  });

  it('センターラインを渡すと道なりの道すじを返す', () => {
    // 東西に伸びる通りを想定
    const centerline = [
      { lat: 33.5620, lng: 133.5340 },
      { lat: 33.5620, lng: 133.5400 },
      { lat: 33.5620, lng: 133.5440 },
    ];
    const result = findNearestFacility(
      { lat: 33.5619, lng: 133.5350 },
      'restroom',
      [makeFacility({ id: 'along-road', lat: 33.5619, lng: 133.5430 })],
      centerline
    );
    // 通りに出る→通りを歩く→施設へ折れる、で3点より多くなる
    expect(result?.route.points.length).toBeGreaterThan(3);
    expect(result?.walkDistanceMeters).toBeGreaterThan(0);
  });

  it('該当カテゴリが無ければnullを返す', () => {
    expect(findNearestFacility(origin, 'transport', facilities)).toBeNull();
  });

  it('施設が空でもnullを返す', () => {
    expect(findNearestFacility(origin, 'restroom', [])).toBeNull();
  });
});

describe('rankFacilitiesByWalk', () => {
  const facilities: Facility[] = [
    makeFacility({ id: 'far', lat: 33.5700, lng: 133.5379 }),
    makeFacility({ id: 'near', lat: 33.5616, lng: 133.5379 }),
    makeFacility({ id: 'middle', lat: 33.5640, lng: 133.5379 }),
    makeFacility({ id: 'other-category', lat: 33.5615, lng: 133.5379, category: 'rest' }),
  ];
  const origin = { lat: 33.5614, lng: 133.5379 };

  it('近い順に並べる', () => {
    const ranked = rankFacilitiesByWalk(origin, 'restroom', facilities);
    expect(ranked.map((entry) => entry.facility.id)).toEqual(['near', 'middle', 'far']);
  });

  it('カテゴリ違いは含めない', () => {
    const ranked = rankFacilitiesByWalk(origin, 'restroom', facilities);
    expect(ranked.some((entry) => entry.facility.id === 'other-category')).toBe(false);
  });

  it('先頭は findNearestFacility と一致する', () => {
    const ranked = rankFacilitiesByWalk(origin, 'restroom', facilities);
    expect(ranked[0].facility.id).toBe(findNearestFacility(origin, 'restroom', facilities)?.facility.id);
  });

  it('該当が無ければ空配列', () => {
    expect(rankFacilitiesByWalk(origin, 'transport', facilities)).toEqual([]);
  });
});

describe('formatDistance', () => {
  it('1000m未満は10m単位のメートル表記', () => {
    expect(formatDistance(123)).toBe('約120m');
    expect(formatDistance(5)).toBe('約10m');
  });

  it('1000m以上はキロメートル表記', () => {
    expect(formatDistance(1240)).toBe('約1.2km');
  });
});
