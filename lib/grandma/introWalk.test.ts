import { describe, it, expect } from 'vitest';
import { computeWalkInStartX, computeWalkOutEndX } from './introWalk';

describe('computeWalkInStartX', () => {
  it('絵の右端が画面の外に出るところまで左へ逃がす', () => {
    // 左端 95px・幅 200px の定位置なら、295px ぶん左へ動かすと右端が画面の左端に並ぶ
    expect(computeWalkInStartX({ left: 95, width: 200 }, 0)).toBe(-295);
  });

  it('影のぶんの余白を足す', () => {
    expect(computeWalkInStartX({ left: 95, width: 200 })).toBe(-319);
  });

  it('定位置が画面の左端にあっても外へ出す', () => {
    expect(computeWalkInStartX({ left: 0, width: 168 }, 10)).toBe(-178);
  });
});

describe('computeWalkOutEndX', () => {
  it('絵の左端が画面の右の外に出るところまで右へ逃がす', () => {
    // 幅 390px の画面で、左端 95px の定位置から出て行くには 295px 動かせばよい
    expect(computeWalkOutEndX({ left: 95, width: 200 }, 390, 0)).toBe(295);
  });

  it('影のぶんの余白を足す', () => {
    expect(computeWalkOutEndX({ left: 95, width: 200 }, 390)).toBe(319);
  });

  it('画面が広いほど遠くまで歩く', () => {
    expect(computeWalkOutEndX({ left: 520, width: 240 }, 1280, 0)).toBe(760);
  });
});
