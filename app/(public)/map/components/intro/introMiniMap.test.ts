import { describe, expect, it } from 'vitest';
import { createMiniMapProjection, roadUpBearing } from './introMiniMap';

const ORIGIN = { lat: 33.5614, lng: 133.538 };
/** 基準点から約100m東 */
const EAST_100M = { lat: 33.5614, lng: 133.538 + 100 / (111_320 * Math.cos((33.5614 * Math.PI) / 180)) };
/** 基準点から約100m北 */
const NORTH_100M = { lat: 33.5614 + 100 / 111_320, lng: 133.538 };

const NO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 };

describe('roadUpBearing', () => {
  it('道の進行方向の反対を上にする（東西の道なら西が上）', () => {
    // 西 → 東 へ延びる道
    const bearing = roadUpBearing([{ lat: 33.5607, lng: 133.5337 }, { lat: 33.5622, lng: 133.5433 }]);
    // 東（約80°）+ 180 = 西寄り
    expect(bearing).toBeGreaterThan(240);
    expect(bearing).toBeLessThan(280);
  });

  it('点が足りなければ北を上にする', () => {
    expect(roadUpBearing([ORIGIN])).toBe(0);
  });
});

describe('createMiniMapProjection', () => {
  it('北を上にしたとき、北は画面の上、東は画面の右になる', () => {
    const { project, pxPerMeter } = createMiniMapProjection({
      upBearing: 0,
      fit: [ORIGIN, EAST_100M, NORTH_100M],
      width: 200,
      height: 200,
      padding: NO_PADDING,
    });
    const o = project(ORIGIN);
    const e = project(EAST_100M);
    const n = project(NORTH_100M);
    expect(e.x).toBeGreaterThan(o.x);
    expect(Math.abs(e.y - o.y)).toBeLessThan(0.5);
    expect(n.y).toBeLessThan(o.y);
    expect(Math.abs(n.x - o.x)).toBeLessThan(0.5);
    // 100m × 100m を 200px に収めるので 2px/m
    expect(pxPerMeter).toBeCloseTo(2, 1);
  });

  it('西を上にすると、北は画面の右になる', () => {
    const { project } = createMiniMapProjection({
      upBearing: 270,
      fit: [ORIGIN, EAST_100M, NORTH_100M],
      width: 200,
      height: 200,
      padding: NO_PADDING,
    });
    const o = project(ORIGIN);
    const n = project(NORTH_100M);
    const e = project(EAST_100M);
    expect(n.x).toBeGreaterThan(o.x);
    expect(Math.abs(n.y - o.y)).toBeLessThan(0.5);
    // 東は下
    expect(e.y).toBeGreaterThan(o.y);
  });

  it('収める点はすべて余白の内側に入り、縦横の縮尺は同じ', () => {
    const padding = { top: 120, right: 60, bottom: 70, left: 60 };
    const width = 300;
    const height = 500;
    const fit = [ORIGIN, EAST_100M, NORTH_100M];
    const { project } = createMiniMapProjection({ upBearing: 260, fit, width, height, padding });
    for (const point of fit) {
      const p = project(point);
      expect(p.x).toBeGreaterThanOrEqual(padding.left - 0.01);
      expect(p.x).toBeLessThanOrEqual(width - padding.right + 0.01);
      expect(p.y).toBeGreaterThanOrEqual(padding.top - 0.01);
      expect(p.y).toBeLessThanOrEqual(height - padding.bottom + 0.01);
    }
    const o = project(ORIGIN);
    const e = project(EAST_100M);
    const n = project(NORTH_100M);
    // 100m 同士なので、画面上の長さも同じ
    expect(Math.hypot(e.x - o.x, e.y - o.y)).toBeCloseTo(Math.hypot(n.x - o.x, n.y - o.y), 3);
  });

  it('点が1つでも縮尺が壊れない', () => {
    const { project, pxPerMeter } = createMiniMapProjection({
      upBearing: 0,
      fit: [ORIGIN],
      width: 100,
      height: 100,
      padding: NO_PADDING,
    });
    expect(Number.isFinite(pxPerMeter)).toBe(true);
    const p = project(ORIGIN);
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });
});
