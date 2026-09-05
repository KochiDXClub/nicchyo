import { describe, expect, it } from 'vitest';
import { distanceInMeters } from '@/lib/facilities/geo';
import { buildGuideNetwork } from './network';
import { findGuideRoute } from './routing';
import type { GuidePath } from './types';

const mainStreet: GuidePath = {
  id: 'main',
  name: '追手筋',
  kind: 'market',
  verified: true,
  points: [
    { lat: 33.562, lng: 133.534 },
    { lat: 33.562, lng: 133.538 },
    { lat: 33.562, lng: 133.542 },
  ],
};

const sideStreet: GuidePath = {
  id: 'side',
  name: '帯屋町アーケード',
  kind: 'path',
  verified: false,
  points: [
    { lat: 33.56195, lng: 133.538 },
    { lat: 33.5605, lng: 133.538 },
  ],
};

const network = buildGuideNetwork([mainStreet, sideStreet]);

describe('findGuideRoute', () => {
  it('本通り沿いの2地点は本通りを通り、始点と終点は入力どおり', () => {
    const origin = { lat: 33.5622, lng: 133.535 };
    const destination = { lat: 33.5618, lng: 133.541 };
    const route = findGuideRoute(origin, destination, network, { destinationName: 'テスト' });

    expect(route.viaNetwork).toBe(true);
    expect(route.points[0]).toEqual(origin);
    expect(route.points[route.points.length - 1]).toEqual(destination);
    expect(route.points.length).toBeGreaterThan(2);
    expect(route.distanceMeters).toBeGreaterThan(distanceInMeters(origin, destination));
    expect(route.walkMinutes).toBeGreaterThan(0);
    // 確認済みの道だけを通るので「おおよそ」ではない
    expect(route.approximate).toBe(false);
  });

  it('横道（未確認の道）を通ると approximate になり、ステップに道の名前が出る', () => {
    const route = findGuideRoute(
      { lat: 33.5622, lng: 133.535 },
      { lat: 33.5604, lng: 133.5381 },
      network,
      { destinationName: '中央公園', originLabel: '現在地' }
    );
    expect(route.viaNetwork).toBe(true);
    expect(route.approximate).toBe(true);
    const text = route.steps.map((s) => s.instruction).join(' / ');
    expect(text).toContain('追手筋を東へ');
    expect(text).toContain('帯屋町アーケード');
    expect(route.steps[0].kind).toBe('depart');
    expect(route.steps[route.steps.length - 1].instruction).toBe('中央公園に到着');
  });

  it('道から離れた近距離同士は直線の目安にする', () => {
    const route = findGuideRoute(
      { lat: 33.5700, lng: 133.5390 },
      { lat: 33.5701, lng: 133.5391 },
      network,
      { destinationName: 'すぐそこ' }
    );
    expect(route.viaNetwork).toBe(false);
    expect(route.points).toHaveLength(2);
  });

  it('ネットワークが無ければ直線', () => {
    const route = findGuideRoute({ lat: 33.562, lng: 133.534 }, { lat: 33.562, lng: 133.542 }, null, {
      destinationName: '東端',
    });
    expect(route.viaNetwork).toBe(false);
    expect(route.steps.some((s) => s.instruction.includes('東へ'))).toBe(true);
  });

  it('西→東と東→西で距離がほぼ同じ', () => {
    const a = { lat: 33.5622, lng: 133.535 };
    const b = { lat: 33.5618, lng: 133.541 };
    const eastward = findGuideRoute(a, b, network, { destinationName: 'b' });
    const westward = findGuideRoute(b, a, network, { destinationName: 'a' });
    expect(westward.distanceMeters).toBeCloseTo(eastward.distanceMeters, 3);
  });
});
