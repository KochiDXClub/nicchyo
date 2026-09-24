import { describe, expect, it } from 'vitest';
import {
  EDGE_SCROLL_MAX_SPEED,
  EDGE_SCROLL_SPEED_PER_PX,
  edgeScrollSpeed,
  passedStopIndex,
  scrubGain,
  scrubScrollTop,
} from './introScrub';

describe('scrubGain', () => {
  it('道の高さで案内全体を送れる倍率にする', () => {
    expect(scrubGain(600, 3000)).toBeCloseTo(5, 5);
  });

  it('上限と下限に収める', () => {
    expect(scrubGain(100, 3000)).toBe(8);
    expect(scrubGain(600, 100)).toBe(1);
    expect(scrubGain(100, 3000, { maxGain: 4 })).toBe(4);
  });

  it('道の高さが 0 でも壊れない', () => {
    expect(Number.isFinite(scrubGain(0, 3000))).toBe(true);
  });
});

describe('scrubScrollTop', () => {
  const base = { anchorScrollTop: 1000, anchorY: 100, gain: 5, maxScroll: 3000 };

  it('基準の位置では変わらず、上下どちらへも同じ倍率で動く', () => {
    expect(scrubScrollTop({ ...base, y: 100 })).toBe(1000);
    expect(scrubScrollTop({ ...base, y: 140 })).toBe(1200);
    expect(scrubScrollTop({ ...base, y: 60 })).toBe(800);
  });

  it('先頭と最後で止める', () => {
    expect(scrubScrollTop({ ...base, y: -500 })).toBe(0);
    expect(scrubScrollTop({ ...base, y: 900 })).toBe(3000);
  });
});

describe('edgeScrollSpeed', () => {
  it('道の内側では送らない', () => {
    expect(edgeScrollSpeed(100, 20, 620)).toBe(0);
    expect(edgeScrollSpeed(20, 20, 620)).toBe(0);
    expect(edgeScrollSpeed(620, 20, 620)).toBe(0);
  });

  it('上端を越えたら上へ、下端を越えたら下へ、越えたぶんだけ速く送る', () => {
    expect(edgeScrollSpeed(10, 20, 620)).toBe(-10 * EDGE_SCROLL_SPEED_PER_PX);
    expect(edgeScrollSpeed(640, 20, 620)).toBe(20 * EDGE_SCROLL_SPEED_PER_PX);
  });

  it('速さには上限がある', () => {
    expect(edgeScrollSpeed(-1000, 20, 620)).toBe(-EDGE_SCROLL_MAX_SPEED);
    expect(edgeScrollSpeed(5000, 20, 620)).toBe(EDGE_SCROLL_MAX_SPEED);
  });
});

describe('passedStopIndex', () => {
  const anchors = [0, 316, 989, 1612];
  it('通り過ぎた停留点の番号を返す', () => {
    expect(passedStopIndex(0, anchors)).toBe(0);
    expect(passedStopIndex(315, anchors)).toBe(0);
    expect(passedStopIndex(316, anchors)).toBe(1);
    expect(passedStopIndex(1200, anchors)).toBe(2);
    expect(passedStopIndex(5000, anchors)).toBe(3);
  });
});
