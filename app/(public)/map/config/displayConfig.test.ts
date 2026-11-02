import { describe, it, expect } from 'vitest';
import {
  DETAIL_STALL_SCALE,
  ILLUSTRATION_SIZES,
  getDetailStallScale,
  getIllustrationAnchor,
  getShopMarkerLod,
  getShopMarkerScale,
} from './displayConfig';

describe('getIllustrationAnchor', () => {
  it('屋台の足元中央を指す', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const { width, height } = ILLUSTRATION_SIZES[size];
      expect(getIllustrationAnchor(size)).toEqual([width / 2, height]);
    }
  });
});

describe('getShopMarkerLod', () => {
  // メインマップ: maxZoom = 21
  it('メインマップで4段階すべてに到達する', () => {
    expect(getShopMarkerLod(18.5, 21)).toBe('dot');
    expect(getShopMarkerLod(19.0, 21)).toBe('stall');
    expect(getShopMarkerLod(19.5, 21)).toBe('stall');
    expect(getShopMarkerLod(19.6, 21)).toBe('photo');
    expect(getShopMarkerLod(20.1, 21)).toBe('photo');
    expect(getShopMarkerLod(20.2, 21)).toBe('nameplate');
    expect(getShopMarkerLod(21.0, 21)).toBe('nameplate');
  });

  // map-edit プレビュー: maxZoom = 20
  it('maxZoom が異なっても同じ4段階が成立する', () => {
    expect(getShopMarkerLod(17.5, 20)).toBe('dot');
    expect(getShopMarkerLod(18.0, 20)).toBe('stall');
    expect(getShopMarkerLod(18.6, 20)).toBe('photo');
    expect(getShopMarkerLod(19.2, 20)).toBe('nameplate');
    expect(getShopMarkerLod(20.0, 20)).toBe('nameplate');
  });

  it('境界ちょうどは上の段階に含める', () => {
    expect(getShopMarkerLod(21 - 0.8, 21)).toBe('nameplate');
    expect(getShopMarkerLod(21 - 1.4, 21)).toBe('photo');
    expect(getShopMarkerLod(21 - 2.0, 21)).toBe('stall');
  });
});

describe('getShopMarkerScale', () => {
  it('maxZoom で等倍、maxZoom-2 で 0.6 になる', () => {
    expect(getShopMarkerScale(21, 21)).toBe(1);
    expect(getShopMarkerScale(19, 21)).toBe(0.6);
  });

  it('範囲外はクランプする', () => {
    expect(getShopMarkerScale(22, 21)).toBe(1);
    expect(getShopMarkerScale(15, 21)).toBe(0.6);
  });

  it('0.05 刻みに量子化される', () => {
    for (let z = 19; z <= 21; z += 0.05) {
      const scale = getShopMarkerScale(z, 21);
      expect(Math.round(scale * 20)).toBeCloseTo(scale * 20, 10);
    }
  });

  it('ズームインに対して単調非減少（旧実装の 19.7-19.8 の突起がない）', () => {
    let prev = 0;
    for (let z = 19; z <= 21.0001; z += 0.05) {
      const scale = getShopMarkerScale(z, 21);
      expect(scale).toBeGreaterThanOrEqual(prev);
      prev = scale;
    }
  });
});

describe('getDetailStallScale', () => {
  it('最大ズームまでは 1、一段先で DETAIL_STALL_SCALE、その間は直線', () => {
    expect(getDetailStallScale(19, 21)).toBe(1);
    expect(getDetailStallScale(21, 21)).toBe(1);
    expect(getDetailStallScale(21.5, 21)).toBeCloseTo(1 + (DETAIL_STALL_SCALE - 1) / 2, 5);
    expect(getDetailStallScale(22, 21)).toBe(DETAIL_STALL_SCALE);
    expect(getDetailStallScale(23, 21)).toBe(DETAIL_STALL_SCALE);
  });
});
