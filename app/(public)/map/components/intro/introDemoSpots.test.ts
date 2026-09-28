import { describe, expect, it } from 'vitest';
import { FALLBACK_INTRO_RESTROOMS, pickIntroRestrooms } from './introDemoSpots';
import type { Landmark } from '../../types/landmark';

function landmark(key: string, category: Landmark['category']): Landmark {
  return {
    key,
    name: key,
    description: '',
    url: '/x.svg',
    lat: 33.56,
    lng: 133.53,
    widthPx: 40,
    heightPx: 40,
    showAtMinZoom: false,
    category,
  };
}

describe('pickIntroRestrooms', () => {
  it('ランドマークが無ければ、本番の seed と同じ4か所の控えを使う', () => {
    const picked = pickIntroRestrooms(undefined);
    expect(picked.map((s) => s.landmarkKey)).toEqual(FALLBACK_INTRO_RESTROOMS.map((l) => l.key));
    expect(picked.every((s) => s.kind === 'restroom')).toBe(true);
    expect(pickIntroRestrooms([])).toHaveLength(FALLBACK_INTRO_RESTROOMS.length);
  });

  it('ランドマークからお手洗いだけを本番と同じ形のスポットにする', () => {
    const picked = pickIntroRestrooms([
      landmark('tram-a', 'transit'),
      landmark('wc-1', 'restroom'),
      landmark('bench', 'rest'),
      landmark('wc-2', 'restroom'),
    ]);
    expect(picked.map((s) => s.id)).toEqual(['landmark:wc-1', 'landmark:wc-2']);
    expect(picked[0].kind).toBe('restroom');
    expect(picked[0].iconUrl).toBe('/x.svg');
  });

  it('お手洗いが1つも無いときは控えに落ちる', () => {
    const picked = pickIntroRestrooms([landmark('tram-a', 'transit'), landmark('bench', 'rest')]);
    expect(picked).toHaveLength(FALLBACK_INTRO_RESTROOMS.length);
  });
});
