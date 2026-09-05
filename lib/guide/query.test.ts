import { describe, expect, it } from 'vitest';
import { guideHrefForKind, parseGuideQuery } from './query';

describe('parseGuideQuery', () => {
  it('guide=menu は種類なしで開く', () => {
    expect(parseGuideQuery(new URLSearchParams('guide=menu'))).toEqual({ kinds: [] });
  });

  it('facility=transport は のりもの1種類に変換される', () => {
    expect(parseGuideQuery(new URLSearchParams('facility=transport'))?.kinds).toEqual(['transit']);
    expect(parseGuideQuery(new URLSearchParams('facility=restroom'))?.kinds).toEqual(['restroom']);
    expect(parseGuideQuery(new URLSearchParams('facility=rest'))?.kinds).toEqual(['rest']);
  });

  it('知らない値・パラメータなしは null', () => {
    expect(parseGuideQuery(new URLSearchParams('guide=unknown'))).toBeNull();
    expect(parseGuideQuery(new URLSearchParams('facility=unknown'))).toBeNull();
    expect(parseGuideQuery(new URLSearchParams(''))).toBeNull();
    expect(parseGuideQuery(null)).toBeNull();
  });
});

describe('guideHrefForKind', () => {
  it('種類ごとのリンクは facility= 形式を保つ', () => {
    expect(guideHrefForKind('transit')).toBe('/map?facility=transport');
    expect(guideHrefForKind('restroom')).toBe('/map?facility=restroom');
    expect(guideHrefForKind('landmark')).toBe('/map?guide=menu');
  });
});
