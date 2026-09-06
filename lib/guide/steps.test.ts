import { describe, expect, it } from 'vitest';
import { bearingDegrees, buildRouteSteps, compassLabel } from './steps';

describe('bearingDegrees / compassLabel', () => {
  it('真東は 90 度・「東」', () => {
    const bearing = bearingDegrees({ lat: 33.562, lng: 133.534 }, { lat: 33.562, lng: 133.54 });
    expect(bearing).toBeCloseTo(90, 0);
    expect(compassLabel(bearing)).toBe('東');
  });

  it('真南は 180 度・「南」、真北は「北」', () => {
    expect(compassLabel(bearingDegrees({ lat: 33.562, lng: 133.534 }, { lat: 33.561, lng: 133.534 }))).toBe('南');
    expect(compassLabel(bearingDegrees({ lat: 33.561, lng: 133.534 }, { lat: 33.562, lng: 133.534 }))).toBe('北');
  });

  it('斜めは 8 方位に丸める', () => {
    expect(compassLabel(45)).toBe('北東');
    expect(compassLabel(300)).toBe('北西');
    expect(compassLabel(359)).toBe('北');
  });
});

describe('buildRouteSteps', () => {
  it('道へ出る → 直進 → 曲がる → 直進 → 到着 の順で組み立てる', () => {
    const steps = buildRouteSteps(
      [
        // 現在地から追手筋へ（道の外）
        { from: { lat: 33.5622, lng: 133.535 }, to: { lat: 33.562, lng: 133.535 }, pathName: null },
        // 追手筋を東へ 2 区間（同じ向きなので 1 ステップにまとまる）
        { from: { lat: 33.562, lng: 133.535 }, to: { lat: 33.562, lng: 133.537 }, pathName: '追手筋' },
        { from: { lat: 33.562, lng: 133.537 }, to: { lat: 33.562, lng: 133.538 }, pathName: '追手筋' },
        // 右へ曲がって南へ
        { from: { lat: 33.562, lng: 133.538 }, to: { lat: 33.5605, lng: 133.538 }, pathName: '帯屋町アーケード' },
      ],
      { originLabel: '現在地', destinationName: '中央公園' }
    );

    expect(steps.map((s) => s.kind)).toEqual(['depart', 'straight', 'straight', 'turn-right', 'straight', 'arrive']);
    expect(steps[0].instruction).toBe('現在地から追手筋へ出る');
    expect(steps[2].instruction).toMatch(/^追手筋を東へ約\d+m$/);
    expect(steps[3].instruction).toBe('右へ曲がって帯屋町アーケードへ');
    expect(steps[4].instruction).toMatch(/^帯屋町アーケードを南へ約\d+m$/);
    expect(steps[5].instruction).toBe('中央公園に到着');
  });

  it('左折は「左へ」になる', () => {
    const steps = buildRouteSteps(
      [
        { from: { lat: 33.562, lng: 133.535 }, to: { lat: 33.562, lng: 133.538 }, pathName: '追手筋' },
        { from: { lat: 33.562, lng: 133.538 }, to: { lat: 33.5635, lng: 133.538 }, pathName: '駅前の通り' },
      ],
      { destinationName: '高知駅' }
    );
    expect(steps.some((s) => s.kind === 'turn-left' && s.instruction.includes('駅前の通り'))).toBe(true);
  });

  it('道へ出る数メートルや到着前の数メートルは、独立したステップにしない', () => {
    const steps = buildRouteSteps(
      [
        // 現在地から道へ 3m（西）
        { from: { lat: 33.562, lng: 133.53503 }, to: { lat: 33.562, lng: 133.535 }, pathName: null },
        { from: { lat: 33.562, lng: 133.535 }, to: { lat: 33.562, lng: 133.538 }, pathName: '追手筋' },
        // 道から目的地へ 5m（北）
        { from: { lat: 33.562, lng: 133.538 }, to: { lat: 33.56205, lng: 133.538 }, pathName: null },
      ],
      { destinationName: '中央公園' }
    );
    expect(steps.map((s) => s.kind)).toEqual(['depart', 'straight', 'arrive']);
    expect(steps[1].instruction).toMatch(/^追手筋を東へ約\d+m$/);
  });

  it('区間が無ければ「すぐそこ」', () => {
    const steps = buildRouteSteps([], { destinationName: 'ベンチ' });
    expect(steps).toHaveLength(1);
    expect(steps[0].instruction).toBe('ベンチはすぐそこです');
  });
});
