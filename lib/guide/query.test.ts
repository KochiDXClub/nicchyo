import { buildMapUrl, guideHrefForKind, parseGuideQuery } from './query';

describe('parseGuideQuery', () => {
  it('guide=menu は種類なしで開く', () => {
    expect(parseGuideQuery(new URLSearchParams('guide=menu'))).toEqual({ kinds: [] });
  });

  it('facility=transport は のりもの1種類に変換される', () => {
    expect(parseGuideQuery(new URLSearchParams('facility=transport'))?.kinds).toEqual(['transit']);
    expect(parseGuideQuery(new URLSearchParams('facility=restroom'))?.kinds).toEqual(['restroom']);
    expect(parseGuideQuery(new URLSearchParams('facility=rest'))?.kinds).toEqual(['rest']);
    expect(parseGuideQuery(new URLSearchParams('facility=evacuation'))?.kinds).toEqual(['evacuation']);
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
    expect(guideHrefForKind('evacuation')).toBe('/map?facility=evacuation');
    expect(guideHrefForKind('landmark')).toBe('/map?guide=menu');
  });
});

describe('buildMapUrl', () => {
  it('guide が開いているときは店舗指定時も guide=menu を引き継ぐ', () => {
    const url = buildMapUrl({
      currentSearch: '?guide=menu',
      guideActive: true,
      updates: { shop: '42' },
    });
    expect(url).toBe('/map?guide=menu&shop=42');
  });

  it('URL にまだ guide が無くても guideActive が true なら guide=menu を付与する', () => {
    const url = buildMapUrl({
      currentSearch: '',
      guideActive: true,
      updates: { shop: '42' },
    });
    expect(url).toBe('/map?guide=menu&shop=42');
  });

  it('guide を閉じる指定（guide: null）で guide パラメータを消し、他を残す', () => {
    const url = buildMapUrl({
      currentSearch: '?guide=menu&shop=42',
      updates: { guide: null },
    });
    expect(url).toBe('/map?shop=42');
  });

  it('guideActive が false のときは guide を削除する', () => {
    const url = buildMapUrl({
      currentSearch: '?guide=menu&shop=42',
      guideActive: false,
    });
    expect(url).toBe('/map?shop=42');
  });

  it('既存の mapFlags や panel などの他パラメータを維持する', () => {
    const url = buildMapUrl({
      currentSearch: '?mapFlags=renderer%3Amaplibre&guide=menu&panel=search',
      updates: { panel: null },
    });
    expect(url).toBe('/map?mapFlags=renderer%3Amaplibre&guide=menu');
  });

  it('旧 facility パラメータは削除される', () => {
    const url = buildMapUrl({
      currentSearch: '?facility=restroom',
      updates: { guide: 'menu' },
    });
    expect(url).toBe('/map?guide=menu');
  });

  it('パラメータが空のときは /map を返す', () => {
    const url = buildMapUrl({
      currentSearch: '',
      guideActive: false,
    });
    expect(url).toBe('/map');
  });
});
