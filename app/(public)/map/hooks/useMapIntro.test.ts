import { describe, expect, it } from 'vitest';
import { hasMapDeepLink, shouldAutoOpenMapIntro } from './useMapIntro';

function params(search: string) {
  return new URLSearchParams(search);
}

describe('hasMapDeepLink', () => {
  it('パラメータがなければディープリンクではない', () => {
    expect(hasMapDeepLink(params(''))).toBe(false);
    expect(hasMapDeepLink(null)).toBe(false);
  });

  it('QR や共有リンクで来た指定をディープリンクとみなす', () => {
    expect(hasMapDeepLink(params('shop=12'))).toBe(true);
    expect(hasMapDeepLink(params('guide=menu'))).toBe(true);
    expect(hasMapDeepLink(params('facility=restroom'))).toBe(true);
    expect(hasMapDeepLink(params('ai=1'))).toBe(true);
    expect(hasMapDeepLink(params('search=1&label=野菜'))).toBe(true);
    expect(hasMapDeepLink(params('q=%E9%87%8E%E8%8F%9C'))).toBe(true);
    expect(hasMapDeepLink(params('walkPlan=1'))).toBe(true);
    expect(hasMapDeepLink(params('panel=search'))).toBe(true);
  });

  it('値が空のパラメータは指定なしとして扱う', () => {
    expect(hasMapDeepLink(params('shop='))).toBe(false);
  });

  it('案内に関係しないパラメータは無視する', () => {
    expect(hasMapDeepLink(params('mapFlags=1'))).toBe(false);
  });
});

describe('shouldAutoOpenMapIntro', () => {
  it('地図が出る前は開かない', () => {
    expect(shouldAutoOpenMapIntro({ seen: false, hasDeepLink: false, mapArrived: false })).toBe(false);
  });

  it('初回で地図が出たら開く', () => {
    expect(shouldAutoOpenMapIntro({ seen: false, hasDeepLink: false, mapArrived: true })).toBe(true);
  });

  it('一度見た人には開かない', () => {
    expect(shouldAutoOpenMapIntro({ seen: true, hasDeepLink: false, mapArrived: true })).toBe(false);
  });

  it('ディープリンクで来た人の画面には被せない', () => {
    expect(shouldAutoOpenMapIntro({ seen: false, hasDeepLink: true, mapArrived: true })).toBe(false);
  });
});
