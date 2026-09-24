import { describe, expect, it } from 'vitest';
import { createScrubMapping, passedStopIndex } from './introScrub';

describe('createScrubMapping', () => {
  const base = { grabY: 100, grabScrollTop: 1000, minY: 20, maxY: 620, maxScroll: 3000 };

  it('つまんだ位置ではスクロール位置が変わらない', () => {
    expect(createScrubMapping(base)(100)).toBe(1000);
  });

  it('道の下端まで引くと最後、上端まで戻すと先頭になる', () => {
    // 上へ戻す余地が十分ある（倍率の上限に掛からない）つまみ方
    const map = createScrubMapping({ ...base, grabY: 300 });
    expect(map(620)).toBe(3000);
    expect(map(20)).toBe(0);
  });

  it('あいだは比例で埋まる（上下で倍率が違ってよい）', () => {
    const map = createScrubMapping(base);
    // 下: 残り 2000px を 520px で割るので約 3.85 倍
    expect(map(360)).toBe(2000);
    // 上: 残り 1000px を 80px で割るので 12.5 倍 → 上限 8 倍に掛かる
    expect(map(60)).toBe(1000 - 40 * 8);
  });

  it('範囲の外の指は端で止める', () => {
    const map = createScrubMapping({ ...base, grabY: 300 });
    expect(map(-50)).toBe(0);
    expect(map(900)).toBe(3000);
  });

  it('上端のすぐそばでつまんだときは倍率の上限に掛かり、一度では先頭まで届かない', () => {
    const map = createScrubMapping(base);
    expect(map(20)).toBe(1000 - 80 * 8);
  });

  it('倍率の上限は変えられる', () => {
    const map = createScrubMapping({ ...base, maxGain: 2 });
    expect(map(60)).toBe(1000 - 40 * 2);
  });

  it('最後に居るときは下へ引いても動かず、先頭では上へ戻しても動かない', () => {
    expect(createScrubMapping({ ...base, grabScrollTop: 3000 })(620)).toBe(3000);
    expect(createScrubMapping({ ...base, grabScrollTop: 0 })(20)).toBe(0);
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
