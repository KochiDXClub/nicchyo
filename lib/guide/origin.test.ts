import { describe, expect, it } from 'vitest';
import { describeOrigin, resolveOrigin, VENUE_CENTER } from './origin';

describe('resolveOrigin', () => {
  it('選んだスポットがあればそれを起点にする', () => {
    const origin = resolveOrigin({
      spot: { id: 'landmark:tram-harimayabashi', name: 'はりまや橋停留場', lat: 33.5596, lng: 133.5424 },
      geolocation: { point: { lat: 33.562, lng: 133.538 } },
    });
    expect(origin.type).toBe('spot');
    expect(origin.label).toBe('はりまや橋停留場');
    expect(describeOrigin(origin)).toBe('はりまや橋停留場から');
  });

  it('現在地が取れていればそれを使う', () => {
    const origin = resolveOrigin({ geolocation: { point: { lat: 33.562, lng: 133.538 }, accuracyMeters: 12 } });
    expect(origin.type).toBe('geolocation');
    expect(origin.accuracyMeters).toBe(12);
    expect(describeOrigin(origin)).toBe('現在地から');
  });

  it('現在地が会場の外でも、そのまま起点にする', () => {
    const origin = resolveOrigin({
      geolocation: { point: { lat: 33.5677, lng: 133.5437 } },
      mapCenter: { lat: 33.5615, lng: 133.54 },
    });
    expect(origin.type).toBe('geolocation');
    expect(origin.point).toEqual({ lat: 33.5677, lng: 133.5437 });
  });

  it('現在地が無ければ地図の中心を使う', () => {
    const origin = resolveOrigin({ mapCenter: { lat: 33.5615, lng: 133.54 } });
    expect(origin.type).toBe('map-center');
  });

  it('何も無ければ会場の中心', () => {
    const origin = resolveOrigin({});
    expect(origin.type).toBe('venue');
    expect(origin.point).toEqual(VENUE_CENTER);
  });
});
