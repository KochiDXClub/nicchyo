import { describe, expect, it } from 'vitest';
import type { Landmark } from '@/app/(public)/map/types/landmark';
import { getDefaultMapRouteConfig, getDefaultMapRoutePoints } from '@/app/(public)/map/utils/mapRouteGeometry';
import { buildSpotSupportPrompt, buildSupportNetwork, buildSupportSuggestions } from './support';

const makeLandmark = (overrides: Partial<Landmark> & Pick<Landmark, 'key'>): Landmark => ({
  name: overrides.key,
  description: '',
  url: '',
  lat: 33.5614,
  lng: 133.538,
  widthPx: 40,
  heightPx: 40,
  showAtMinZoom: true,
  ...overrides,
});

const landmarks: Landmark[] = [
  makeLandmark({ key: 'restroom-central-park', name: '中央公園 公衆お手洗い', category: 'restroom', lat: 33.5609, lng: 133.5376, tags: ['多目的あり'] }),
  makeLandmark({ key: 'rest-central-park', name: '中央公園', category: 'rest', lat: 33.561, lng: 133.5379 }),
  makeLandmark({ key: 'tram-ohashidori', name: '大橋通停留場', category: 'transit', transitMode: 'tram', lat: 33.5589806, lng: 133.5366611, lines: ['伊野線'] }),
  makeLandmark({ key: 'tram-harimayabashi', name: 'はりまや橋停留場', category: 'transit', transitMode: 'tram', lat: 33.5596333, lng: 133.5423972 }),
  makeLandmark({ key: 'castle', name: '高知城', category: 'landmark', lat: 33.56, lng: 133.531 }),
];

const network = buildSupportNetwork({ points: getDefaultMapRoutePoints(), config: getDefaultMapRouteConfig() });

describe('buildSupportSuggestions', () => {
  it('お手洗い・休けい・のりものを1件ずつ、近い順の先頭で返す', () => {
    const suggestions = buildSupportSuggestions(landmarks, network, { lat: 33.5614, lng: 133.538 });
    expect(suggestions.map((s) => s.kind)).toEqual(['restroom', 'rest', 'transit']);
    expect(suggestions[2].spotName).toBe('大橋通停留場');
    expect(suggestions[0].walkMinutes).toBeGreaterThan(0);
    expect(suggestions[0].href).toBe('/map?facility=restroom');
  });

  it('起点が無ければ会場の中心から', () => {
    const suggestions = buildSupportSuggestions(landmarks, network, null);
    expect(suggestions).toHaveLength(3);
  });

  it('該当する種別が無ければその項目は省く', () => {
    const suggestions = buildSupportSuggestions([landmarks[4]], network, null);
    expect(suggestions).toEqual([]);
  });
});

describe('buildSpotSupportPrompt', () => {
  it('近い施設とスポット一覧を人が読める形にする', () => {
    const suggestions = buildSupportSuggestions(landmarks, network, { lat: 33.5614, lng: 133.538 });
    const prompt = buildSpotSupportPrompt(landmarks, suggestions);
    expect(prompt).toContain('いちばん近い施設');
    expect(prompt).toContain('お手洗い: 中央公園 公衆お手洗い（徒歩');
    expect(prompt).toContain('大橋通停留場（電停・駅） / 路線: 伊野線');
    expect(prompt).toContain('/map?facility=restroom');
  });
});
