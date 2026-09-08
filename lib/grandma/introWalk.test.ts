import { describe, it, expect } from 'vitest';
import { computeWalkInStartX } from './introWalk';

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
