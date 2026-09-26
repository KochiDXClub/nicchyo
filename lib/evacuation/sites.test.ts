import { describe, expect, it } from 'vitest';
import { distanceInMeters } from '@/lib/facilities/geo';
import { venueOrigin } from '@/lib/guide/origin';
import { rankSpots } from '@/lib/guide/ranking';
import { evacuationSiteToSpot } from '@/lib/spots';
import {
  EVACUATION_DATA_SOURCE,
  EVACUATION_SITES,
  HAZARD_LABELS,
  HAZARD_ORDER,
  hazardLabelsOf,
  sitesForHazard,
  type HazardType,
} from './sites';

/** 追手筋のおおよその中心 */
const VENUE_CENTER = { lat: 33.5614, lng: 133.5385 };

describe('EVACUATION_SITES（公式データを写したもの）', () => {
  it('会場まわりの避難場所が入っている', () => {
    expect(EVACUATION_SITES.length).toBeGreaterThan(0);
  });

  it('ID は国土地理院の共通IDで、重ならない', () => {
    const ids = EVACUATION_SITES.map((site) => site.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^E392010\d+$/);
  });

  it('どの場所にも、使える災害の種類が1つ以上ある', () => {
    const known = new Set<string>(HAZARD_ORDER);
    for (const site of EVACUATION_SITES) {
      expect(site.hazards.length).toBeGreaterThan(0);
      for (const hazard of site.hazards) expect(known.has(hazard)).toBe(true);
    }
  });

  it('座標は会場から徒歩圏（1.5km以内）にある', () => {
    for (const site of EVACUATION_SITES) {
      expect(distanceInMeters(VENUE_CENTER, site)).toBeLessThan(1500);
    }
  });

  it('津波・地震それぞれの避難先がある', () => {
    expect(sitesForHazard(EVACUATION_SITES, 'tsunami').length).toBeGreaterThan(0);
    expect(sitesForHazard(EVACUATION_SITES, 'earthquake').length).toBeGreaterThan(0);
  });

  it('出典と取得日がそろっている', () => {
    expect(EVACUATION_DATA_SOURCE.credit).toContain('国土地理院');
    expect(EVACUATION_DATA_SOURCE.credit).toContain('加工して作成');
    expect(EVACUATION_DATA_SOURCE.url).toMatch(/^https:\/\//);
    expect(EVACUATION_DATA_SOURCE.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('hazardLabelsOf', () => {
  it('急ぐ災害から順に並べる', () => {
    const hazards: HazardType[] = ['flood', 'fire', 'tsunami'];
    expect(hazardLabelsOf({ hazards })).toEqual([HAZARD_LABELS.tsunami, HAZARD_LABELS.fire, HAZARD_LABELS.flood]);
  });
});

describe('sitesForHazard', () => {
  it('指定されていない災害の避難先は返さない', () => {
    const sites = [
      { id: 'a', name: 'A', address: '', lat: 0, lng: 0, hazards: ['fire' as const], isShelter: false },
      { id: 'b', name: 'B', address: '', lat: 0, lng: 0, hazards: ['tsunami' as const], isShelter: false },
    ];
    expect(sitesForHazard(sites, 'tsunami').map((site) => site.id)).toEqual(['b']);
  });
});

describe('おでかけサポートでの絞り込み', () => {
  const spots = EVACUATION_SITES.map(evacuationSiteToSpot);

  it('「地震」を選ぶと、地震の指定がある場所だけが近い順に出る', () => {
    const ranked = rankSpots(spots, {
      origin: venueOrigin(),
      network: null,
      kinds: ['evacuation'],
      requiredAnyTags: [HAZARD_LABELS.earthquake],
    });
    const expected = sitesForHazard(EVACUATION_SITES, 'earthquake').length;
    expect(ranked).toHaveLength(expected);
    for (const entry of ranked) expect(entry.spot.tags).toContain(HAZARD_LABELS.earthquake);
    const distances = ranked.map((entry) => entry.route?.distanceMeters ?? 0);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('ほかの種類（お手洗いなど）を選んでいるときは出ない', () => {
    const ranked = rankSpots(spots, { origin: venueOrigin(), network: null, kinds: ['restroom'] });
    expect(ranked).toHaveLength(0);
  });
});
