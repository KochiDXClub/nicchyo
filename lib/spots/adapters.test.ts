import { describe, expect, it } from 'vitest';
import type { Landmark } from '@/app/(public)/map/types/landmark';
import type { Facility } from '@/lib/facilities/facilities';
import { facilityToSpot, getTransitModeFromLandmarkKey, landmarkToSpot } from './adapters';
import { JR_ACCENT_COLOR, TRAM_ACCENT_COLOR } from './spotMeta';

const baseLandmark: Landmark = {
  key: 'castle',
  name: '高知城',
  description: '日曜市の西の端にある城。',
  url: '/images/maps/elements/castle.png',
  lat: 33.56,
  lng: 133.53,
  widthPx: 80,
  heightPx: 60,
  showAtMinZoom: true,
};

describe('getTransitModeFromLandmarkKey', () => {
  it('電停・JR駅・その他を判別する', () => {
    expect(getTransitModeFromLandmarkKey('tram-harimayabashi')).toBe('tram');
    expect(getTransitModeFromLandmarkKey('jr-kochi-station')).toBe('jr');
    expect(getTransitModeFromLandmarkKey('castle')).toBeNull();
    // 装飾用のチンチン電車イラストは乗り場ではない
    expect(getTransitModeFromLandmarkKey('densha')).toBeNull();
  });
});

describe('landmarkToSpot', () => {
  it('建物は landmark 種別になる', () => {
    const spot = landmarkToSpot(baseLandmark);
    expect(spot.id).toBe('landmark:castle');
    expect(spot.kind).toBe('landmark');
    expect(spot.name).toBe('高知城');
    expect(spot.iconUrl).toBe(baseLandmark.url);
    expect(spot.landmarkKey).toBe('castle');
  });

  it('電停は transit/tram、JR駅は transit/jr になり色も分かれる', () => {
    const tram = landmarkToSpot({ ...baseLandmark, key: 'tram-ohashidori', name: '大橋通停留場' });
    expect(tram.kind).toBe('transit');
    expect(tram.transitMode).toBe('tram');
    expect(tram.accentColor).toBe(TRAM_ACCENT_COLOR);

    const jr = landmarkToSpot({ ...baseLandmark, key: 'jr-kochi-station', name: 'JR高知駅' });
    expect(jr.transitMode).toBe('jr');
    expect(jr.accentColor).toBe(JR_ACCENT_COLOR);
  });
});

describe('facilityToSpot', () => {
  it('お手洗いは restroom 種別で facility: 接頭辞のIDになる', () => {
    const facility: Facility = {
      id: 'restroom-central-park',
      category: 'restroom',
      name: '中央公園 公衆お手洗い',
      area: '日曜市の通りから南へすぐ',
      note: '会場のどこからでも向かいやすい場所です。',
      lat: 33.56,
      lng: 133.54,
    };
    const spot = facilityToSpot(facility);
    expect(spot.id).toBe('facility:restroom-central-park');
    expect(spot.kind).toBe('restroom');
    expect(spot.description).toBe(facility.area);
    expect(spot.notes).toBe(facility.note);
  });

  it('のりもの（ランドマーク由来）は、ランドマークとして開いたときと同じIDになる', () => {
    const facility: Facility = {
      id: 'landmark-tram-harimayabashi',
      category: 'transport',
      name: 'はりまや橋停留場',
      area: 'とさでん交通の路面電車停留場。',
      lat: 33.5596,
      lng: 133.5424,
      iconUrl: '/images/maps/elements/transit/tram-stop.svg',
      markerColor: TRAM_ACCENT_COLOR,
    };
    const fromFacility = facilityToSpot(facility);
    const fromLandmark = landmarkToSpot({
      ...baseLandmark,
      key: 'tram-harimayabashi',
      name: 'はりまや橋停留場',
    });
    expect(fromFacility.id).toBe(fromLandmark.id);
    expect(fromFacility.kind).toBe('transit');
    expect(fromFacility.transitMode).toBe('tram');
  });
});

describe('landmarkToSpot（DBの属性つき）', () => {
  it('category・写真・路線・タグ・外部リンクをそのまま引き継ぐ', () => {
    const spot = landmarkToSpot({
      ...baseLandmark,
      key: 'tram-kochijomae',
      name: '高知城前停留場',
      category: 'transit',
      transitMode: 'tram',
      lines: ['伊野線'],
      tags: [],
      notes: '高知城の最寄り',
      externalUrl: 'https://www.tosaden.co.jp/train/timetable/',
      photoUrl: 'https://example.com/photo.jpg',
      photoCredit: '写真: someone / CC BY 2.0',
    });
    expect(spot.kind).toBe('transit');
    expect(spot.transitMode).toBe('tram');
    expect(spot.lines).toEqual(['伊野線']);
    // 空配列は undefined に落とす（カードで空のチップ領域を出さない）
    expect(spot.tags).toBeUndefined();
    expect(spot.notes).toBe('高知城の最寄り');
    expect(spot.externalUrl).toContain('tosaden');
    expect(spot.photoUrl).toBe('https://example.com/photo.jpg');
    expect(spot.photoCredit).toContain('CC BY');
  });

  it('category が restroom / rest なら key に関係なくその種別になる', () => {
    const restroom = landmarkToSpot({ ...baseLandmark, key: 'restroom-central-park', category: 'restroom' });
    expect(restroom.kind).toBe('restroom');
    expect(restroom.id).toBe('landmark:restroom-central-park');
    const rest = landmarkToSpot({ ...baseLandmark, key: 'rest-central-park', category: 'rest' });
    expect(rest.kind).toBe('rest');
  });

  it('category が無い古いデータは key の規約で判定する', () => {
    expect(landmarkToSpot({ ...baseLandmark, key: 'tram-horizume' }).kind).toBe('transit');
    expect(landmarkToSpot({ ...baseLandmark, key: 'otepia' }).kind).toBe('landmark');
  });
});
