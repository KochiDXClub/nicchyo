import { afterEach, describe, expect, it, vi } from 'vitest';
import { vibrate } from './haptics';

describe('vibrate', () => {
  const original = navigator.vibrate;
  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', { value: original, configurable: true, writable: true });
  });

  it('対応端末では navigator.vibrate を呼ぶ', () => {
    const spy = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true, writable: true });
    expect(vibrate(8)).toBe(true);
    expect(spy).toHaveBeenCalledWith(8);
  });

  it('対応していない端末では何もせず false', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true, writable: true });
    expect(vibrate(8)).toBe(false);
  });

  it('呼び出しが例外を投げても外へ漏らさない', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('blocked');
      },
      configurable: true,
      writable: true,
    });
    expect(vibrate([4, 4])).toBe(false);
  });
});
