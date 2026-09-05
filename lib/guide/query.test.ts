import { describe, expect, it } from 'vitest';
import { guideHrefForKind, guideHrefForPreset, guideQueryValue, parseGuideQuery } from './query';

describe('parseGuideQuery', () => {
  it('guide=<プリセット> はプリセットの種別・条件に展開される', () => {
    const query = parseGuideQuery(new URLSearchParams('guide=rain'));
    expect(query?.presetId).toBe('rain');
    expect(query?.kinds).toEqual(['rest', 'landmark', 'restroom']);
    expect(query?.requiredAnyTags).toEqual(['屋根あり', '屋内']);
  });

  it('guide=menu は種別なしで開く', () => {
    const query = parseGuideQuery(new URLSearchParams('guide=menu'));
    expect(query).toEqual({ presetId: null, kinds: [], requiredAnyTags: [], preferTags: [], hideClosed: false });
  });

  it('旧リンク facility=transport は のりもの1種別に変換される', () => {
    expect(parseGuideQuery(new URLSearchParams('facility=transport'))?.kinds).toEqual(['transit']);
    expect(parseGuideQuery(new URLSearchParams('facility=restroom'))?.kinds).toEqual(['restroom']);
  });

  it('知らない値・パラメータなしは null', () => {
    expect(parseGuideQuery(new URLSearchParams('guide=unknown'))).toBeNull();
    expect(parseGuideQuery(new URLSearchParams('facility=unknown'))).toBeNull();
    expect(parseGuideQuery(new URLSearchParams(''))).toBeNull();
    expect(parseGuideQuery(null)).toBeNull();
  });
});

describe('guideQueryValue / href', () => {
  it('プリセットがあればその id、無ければ menu', () => {
    expect(guideQueryValue({ presetId: 'go-home', kinds: ['transit'] })).toBe('go-home');
    expect(guideQueryValue({ presetId: null, kinds: ['restroom'] })).toBe('menu');
  });

  it('種別ごとのリンクは旧 facility= 形式を保つ', () => {
    expect(guideHrefForKind('transit')).toBe('/map?facility=transport');
    expect(guideHrefForKind('landmark')).toBe('/map?guide=menu');
    expect(guideHrefForPreset('rain')).toBe('/map?guide=rain');
  });
});
