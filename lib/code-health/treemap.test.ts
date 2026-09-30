import { describe, expect, it } from "vitest";
import { colorStep, squarify, VIOLATION_CUTS } from "./treemap";

describe("squarify", () => {
  it("面積の合計が元の矩形と一致する", () => {
    const items = [{ value: 10 }, { value: 20 }, { value: 30 }, { value: 5 }];
    const rects = squarify(items, 0, 0, 100, 50);
    const totalArea = rects.reduce((s, r) => s + r.w * r.h, 0);
    expect(totalArea).toBeCloseTo(100 * 50, 0);
  });

  it("すべての矩形が親の範囲内に収まる", () => {
    const items = [{ value: 3 }, { value: 1 }, { value: 7 }, { value: 2 }, { value: 9 }];
    const rects = squarify(items, 10, 10, 200, 100);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(r.y).toBeGreaterThanOrEqual(10 - 1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(10 + 200 + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(10 + 100 + 1e-6);
    }
  });

  it("value が 0 以下の要素は無視する", () => {
    const items = [{ value: 10 }, { value: 0 }, { value: -5 }];
    const rects = squarify(items, 0, 0, 100, 100);
    expect(rects).toHaveLength(1);
  });

  it("全要素が 0 以下、または幅・高さが 0 なら空配列", () => {
    expect(squarify([{ value: 0 }], 0, 0, 100, 100)).toEqual([]);
    expect(squarify([{ value: 10 }], 0, 0, 0, 100)).toEqual([]);
  });

  it("元の item を保持する", () => {
    const items = [{ value: 5, path: "a.ts" }, { value: 5, path: "b.ts" }];
    const rects = squarify(items, 0, 0, 100, 100);
    const paths = rects.map((r) => r.item.path).sort();
    expect(paths).toEqual(["a.ts", "b.ts"]);
  });
});

describe("colorStep", () => {
  it("区切りの中で正しい段階を返す", () => {
    expect(colorStep(0, VIOLATION_CUTS)).toBe(0);
    expect(colorStep(1, VIOLATION_CUTS)).toBe(1);
    expect(colorStep(2, VIOLATION_CUTS)).toBe(1);
    expect(colorStep(3, VIOLATION_CUTS)).toBe(2);
    expect(colorStep(1000, VIOLATION_CUTS)).toBe(VIOLATION_CUTS.length);
  });
});
