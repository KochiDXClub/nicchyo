import { describe, expect, it } from 'vitest';
import type { MapSpot } from '@/lib/spots';
import { buildGuideNetwork } from './network';
import { geolocationOrigin } from './origin';
import { isSpotOpen, rankSpots } from './ranking';
import type { GuidePath } from './types';

const street: GuidePath = {
  id: 'main',
  name: '追手筋',
  kind: 'market',
  verified: true,
  points: [
    { lat: 33.562, lng: 133.534 },
    { lat: 33.562, lng: 133.542 },
  ],
};
const network = buildGuideNetwork([street]);

const spot = (overrides: Partial<MapSpot> & Pick<MapSpot, 'id' | 'kind' | 'lat' | 'lng'>): MapSpot => ({
  name: overrides.id,
  description: '',
  accentColor: '#000',
  ...overrides,
});

const spots: MapSpot[] = [
  spot({ id: 'near-restroom', kind: 'restroom', lat: 33.5621, lng: 133.535, tags: ['多目的あり'] }),
  spot({ id: 'far-restroom', kind: 'restroom', lat: 33.5621, lng: 133.541 }),
  spot({ id: 'closed-restroom', kind: 'restroom', lat: 33.5621, lng: 133.5352, openFrom: '10:00', openUntil: '18:00' }),
  spot({ id: 'bench', kind: 'rest', lat: 33.5621, lng: 133.536, tags: ['ベンチあり', '屋根あり'] }),
  spot({ id: 'tram', kind: 'transit', lat: 33.5621, lng: 133.54, verified: true }),
  spot({ id: 'unverified-tram', kind: 'transit', lat: 33.5621, lng: 133.5401, verified: false }),
];

const origin = geolocationOrigin({ lat: 33.5622, lng: 133.5345 });
const daytime = new Date('2026-09-06T11:00:00');
const evening = new Date('2026-09-06T19:00:00');

describe('isSpotOpen', () => {
  it('時間の情報が無ければ null', () => {
    expect(isSpotOpen({}, daytime)).toBeNull();
  });
  it('時間帯の内外を判定する', () => {
    expect(isSpotOpen({ openFrom: '10:00', openUntil: '18:00' }, daytime)).toBe(true);
    expect(isSpotOpen({ openFrom: '10:00', openUntil: '18:00' }, evening)).toBe(false);
    expect(isSpotOpen({ openUntil: '18:00' }, evening)).toBe(false);
    expect(isSpotOpen({ openFrom: '06:00' }, evening)).toBe(true);
  });
});

describe('rankSpots', () => {
  it('種別で絞り、近い順に並び、経路が付く', () => {
    const ranked = rankSpots(spots, { origin, network, kinds: ['restroom'], now: daytime });
    expect(ranked.map((r) => r.spot.id)).toEqual(['near-restroom', 'closed-restroom', 'far-restroom']);
    expect(ranked[0].route?.viaNetwork).toBe(true);
    expect(ranked[0].route!.walkMinutes).toBeLessThan(ranked[2].route!.walkMinutes);
  });

  it('時間外のスポットは後ろに回り、hideClosed なら消える', () => {
    const ranked = rankSpots(spots, { origin, network, kinds: ['restroom'], now: evening });
    expect(ranked.map((r) => r.spot.id)).toEqual(['near-restroom', 'far-restroom', 'closed-restroom']);
    expect(ranked[2].isOpen).toBe(false);
    expect(ranked[2].reasons).toContain('時間外');

    const hidden = rankSpots(spots, { origin, network, kinds: ['restroom'], now: evening, hideClosed: true });
    expect(hidden.map((r) => r.spot.id)).toEqual(['near-restroom', 'far-restroom']);
  });

  it('複数種別と条件タグ（必須・いずれか・優先）', () => {
    const rainy = rankSpots(spots, {
      origin,
      network,
      kinds: ['rest', 'restroom'],
      requiredAnyTags: ['屋根あり', '屋内'],
    });
    expect(rainy.map((r) => r.spot.id)).toEqual(['bench']);

    const required = rankSpots(spots, { origin, network, kinds: ['restroom'], requiredTags: ['多目的あり'] });
    expect(required.map((r) => r.spot.id)).toEqual(['near-restroom']);

    const preferred = rankSpots(spots, { origin, network, kinds: ['restroom'], preferTags: ['多目的あり'], now: daytime });
    expect(preferred[0].reasons).toContain('多目的あり');
  });

  it('座標未確認のスポットは同じ距離なら後ろになり「場所はおおよそ」が付く', () => {
    const ranked = rankSpots(spots, { origin, network, kinds: ['transit'] });
    expect(ranked.map((r) => r.spot.id)).toEqual(['tram', 'unverified-tram']);
    expect(ranked[1].reasons).toContain('場所はおおよそ');
  });

  it('起点が無いときは経路なしで条件だけで並ぶ', () => {
    const ranked = rankSpots(spots, { origin: null, network, kinds: ['restroom'], now: daytime });
    expect(ranked).toHaveLength(3);
    expect(ranked.every((r) => r.route === null)).toBe(true);
  });

  it('maxResults で件数を絞る', () => {
    expect(rankSpots(spots, { origin, network, kinds: ['restroom', 'rest', 'transit'], maxResults: 2 })).toHaveLength(2);
  });
});
