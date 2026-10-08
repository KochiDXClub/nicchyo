import { describe, expect, it } from 'vitest';
import type { Landmark } from '@/app/(public)/map/types/landmark';
import { getTransitFacilities, isTransitStopLandmarkKey } from './transitLandmarks';

const makeLandmark = (overrides: Partial<Landmark> & Pick<Landmark, 'key'>): Landmark => ({
  name: overrides.key,
  description: '',
  url: '',
  lat: 33.56,
  lng: 133.54,
  widthPx: 40,
  heightPx: 40,
  showAtMinZoom: true,
  ...overrides,
});

describe('isTransitStopLandmarkKey', () => {
  it('tram-で始まるkeyは対象', () => {
    expect(isTransitStopLandmarkKey('tram-harimayabashi')).toBe(true);
  });

  it('jr-kochi-stationは対象', () => {
    expect(isTransitStopLandmarkKey('jr-kochi-station')).toBe(true);
  });

  it('densha（装飾イラスト）は対象外', () => {
    expect(isTransitStopLandmarkKey('densha')).toBe(false);
  });

  it('無関係なランドマークは対象外', () => {
    expect(isTransitStopLandmarkKey('castle')).toBe(false);
    expect(isTransitStopLandmarkKey('otepia')).toBe(false);
  });
});

describe('getTransitFacilities', () => {
  const landmarks: Landmark[] = [
    makeLandmark({ key: 'castle', name: '高知城' }),
    makeLandmark({
      key: 'tram-harimayabashi',
      name: 'はりまや橋停留場',
      description: '主要な乗りかえ拠点',
      url: '/images/maps/elements/transit/tram-stop.svg',
      lat: 33.5596333,
      lng: 133.5423972,
    }),
    makeLandmark({
      key: 'jr-kochi-station',
      name: '高知駅',
      url: '/images/maps/elements/transit/train-stop.svg',
      lat: 33.5677,
      lng: 133.5437,
    }),
    makeLandmark({ key: 'densha', name: 'チンチン電車' }),
  ];

  it('電停・JR駅だけをFacility形式で返す', () => {
    const result = getTransitFacilities(landmarks);
    expect(result.map((f) => f.id)).toEqual(['landmark-tram-harimayabashi', 'landmark-jr-kochi-station']);
  });

  it('category は transport 固定', () => {
    const result = getTransitFacilities(landmarks);
    expect(result.every((f) => f.category === 'transport')).toBe(true);
  });

  it('name・座標・アイコンURLをそのまま引き継ぐ', () => {
    const [tram] = getTransitFacilities(landmarks);
    expect(tram.name).toBe('はりまや橋停留場');
    expect(tram.area).toBe('主要な乗りかえ拠点');
    expect(tram.lat).toBe(33.5596333);
    expect(tram.lng).toBe(133.5423972);
    expect(tram.iconUrl).toBe('/images/maps/elements/transit/tram-stop.svg');
  });

  it('tram- はオレンジ、それ以外（JR）は青のマーカー色になる', () => {
    const [tram, jr] = getTransitFacilities(landmarks);
    expect(tram.markerColor).toBe('#f97316');
    expect(jr.markerColor).toBe('#1d4ed8');
  });

  it('該当ランドマークが無ければ空配列', () => {
    expect(getTransitFacilities([])).toEqual([]);
    expect(getTransitFacilities([makeLandmark({ key: 'castle' })])).toEqual([]);
  });
});
