import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasSeenMapIntro, markMapIntroSeen, MAP_INTRO_SEEN_KEY } from './mapIntro';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('mapIntro', () => {
  it('記録がなければ「まだ見ていない」', () => {
    expect(hasSeenMapIntro()).toBe(false);
  });

  it('記録したあとは「見た」になる', () => {
    markMapIntroSeen();
    expect(window.localStorage.getItem(MAP_INTRO_SEEN_KEY)).toBe('1');
    expect(hasSeenMapIntro()).toBe(true);
  });

  it('localStorage が読めなくても例外を投げず、案内を出す側に倒す', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(hasSeenMapIntro()).toBe(false);
  });

  it('localStorage に書けなくても例外を投げない', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => markMapIntroSeen()).not.toThrow();
  });
});
