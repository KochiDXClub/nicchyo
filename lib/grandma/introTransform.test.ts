import { describe, it, expect } from 'vitest';
import { computeIntroTransform, toTransformStyle } from './introTransform';

describe('computeIntroTransform', () => {
  it('大きい絵の中心を定位置の中心へ運ぶ', () => {
    const from = { left: 100, top: 100, width: 300, height: 300 };
    const to = { left: 220, top: 400, width: 200, height: 200 };

    const result = computeIntroTransform(from, to);

    // from の中心(250, 250) → to の中心(320, 500)
    expect(result.dx).toBe(70);
    expect(result.dy).toBe(250);
  });

  it('定位置の大きさまで縮む率を返す', () => {
    const result = computeIntroTransform(
      { left: 0, top: 0, width: 320, height: 320 },
      { left: 0, top: 0, width: 160, height: 160 }
    );

    expect(result.scale).toBe(0.5);
  });

  it('中心が同じなら動かさない', () => {
    const result = computeIntroTransform(
      { left: 0, top: 0, width: 200, height: 200 },
      { left: 50, top: 50, width: 100, height: 100 }
    );

    expect(result.dx).toBe(0);
    expect(result.dy).toBe(0);
    expect(result.scale).toBe(0.5);
  });

  it('大きさが取れないときは動かさない値を返す', () => {
    const zeroFrom = computeIntroTransform(
      { left: 0, top: 0, width: 0, height: 0 },
      { left: 10, top: 10, width: 100, height: 100 }
    );
    const zeroTo = computeIntroTransform(
      { left: 0, top: 0, width: 200, height: 200 },
      { left: 10, top: 10, width: 0, height: 0 }
    );

    expect(zeroFrom).toEqual({ dx: 0, dy: 0, scale: 1 });
    expect(zeroTo).toEqual({ dx: 0, dy: 0, scale: 1 });
  });
});

describe('toTransformStyle', () => {
  it('translate してから scale する順で組み立てる', () => {
    expect(toTransformStyle({ dx: 12.345, dy: -6, scale: 0.625 })).toBe(
      'translate(12.35px, -6.00px) scale(0.6250)'
    );
  });
});
