import { describe, expect, it } from 'vitest';
import type { Landmark } from '@/app/(public)/map/types/landmark';
import {
  countFacilitiesByCategory,
  getFacilitiesFromLandmarks,
  getFacilityCategoryOfLandmark,
} from './landmarkFacilities';

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

const landmarks: Landmark[] = [
  makeLandmark({ key: 'castle', category: 'landmark' }),
  makeLandmark({ key: 'tram-harimayabashi', category: 'transit', transitMode: 'tram' }),
  makeLandmark({ key: 'jr-kochi-station', category: 'transit', transitMode: 'jr' }),
  makeLandmark({
    key: 'restroom-central-park',
    category: 'restroom',
    description: '会場の中ほど',
    notes: '多目的トイレあり',
    tags: ['多目的あり'],
    verified: false,
  }),
  makeLandmark({ key: 'rest-central-park', category: 'rest', tags: ['ベンチあり'] }),
  // category が無い古いデータ
  makeLandmark({ key: 'tram-horizume' }),
  makeLandmark({ key: 'densha' }),
];

describe('getFacilityCategoryOfLandmark', () => {
  it('category 列を優先し、無ければ key の規約で判定する', () => {
    expect(getFacilityCategoryOfLandmark(landmarks[0])).toBeNull();
    expect(getFacilityCategoryOfLandmark(landmarks[1])).toBe('transport');
    expect(getFacilityCategoryOfLandmark(landmarks[3])).toBe('restroom');
    expect(getFacilityCategoryOfLandmark(landmarks[4])).toBe('rest');
    expect(getFacilityCategoryOfLandmark(landmarks[5])).toBe('transport');
    expect(getFacilityCategoryOfLandmark(landmarks[6])).toBeNull();
  });
});

describe('getFacilitiesFromLandmarks', () => {
  it('お手洗いは説明・補足・タグ・実測フラグを引き継ぐ', () => {
    const [restroom] = getFacilitiesFromLandmarks(landmarks, 'restroom');
    expect(restroom.id).toBe('landmark-restroom-central-park');
    expect(restroom.area).toBe('会場の中ほど');
    expect(restroom.note).toBe('多目的トイレあり');
    expect(restroom.tags).toEqual(['多目的あり']);
    expect(restroom.verified).toBe(false);
    expect(restroom.markerColor).toBeUndefined();
  });

  it('のりものは電車＝オレンジ、JR＝青のマーカー色になる', () => {
    const transit = getFacilitiesFromLandmarks(landmarks, 'transport');
    expect(transit.map((f) => f.id)).toEqual([
      'landmark-tram-harimayabashi',
      'landmark-jr-kochi-station',
      'landmark-tram-horizume',
    ]);
    expect(transit[0].markerColor).toBe('#f97316');
    expect(transit[1].markerColor).toBe('#1d4ed8');
  });
});

describe('countFacilitiesByCategory', () => {
  it('カテゴリごとの件数を返す', () => {
    expect(countFacilitiesByCategory(landmarks)).toEqual({ restroom: 1, rest: 1, transport: 3 });
  });
});
