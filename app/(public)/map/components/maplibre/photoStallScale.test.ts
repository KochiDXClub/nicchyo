import { describe, expect, it } from "vitest";
import { buildPhotoStallScale, photoStallScaleAt, type PhotoStallScaleInput } from "./photoStallScale";

const input: PhotoStallScaleInput = {
  maxZoom: 20,
  photoStallPx: 84,
  baseStallPx: 60,
  spacingPxAtMax: 95,
  stallLodOffset: -2,
  photoLodOffset: -1.4,
};

describe("photoStallScaleAt", () => {
  it("最大ズームでは写真入りの本来の大きさ（1.0）", () => {
    expect(photoStallScaleAt(0, input)).toBeCloseTo(1, 5);
  });

  it("引いても通常の屋台より小さくはならない", () => {
    for (let offset = 0; offset >= -1.4; offset -= 0.1) {
      const base = 1 + (0.6 - 1) * (-offset / 2);
      expect(photoStallScaleAt(offset, input) * 84).toBeGreaterThanOrEqual(60 * base - 1e-6);
    }
  });

  it("引くほど小さくなる（単調）", () => {
    let prev = Infinity;
    for (let offset = 0; offset >= -1.4; offset -= 0.1) {
      const v = photoStallScaleAt(offset, input);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });

  it("中間のズームでは店舗間隔に収まる大きさに抑える", () => {
    const offset = -0.5;
    const spacing = 95 * 2 ** offset;
    expect(photoStallScaleAt(offset, input) * 84).toBeLessThanOrEqual(spacing);
  });
});

describe("buildPhotoStallScale", () => {
  it("zoom の interpolate で、写真の LOD から最大ズームまでの stops を作る", () => {
    const expr = buildPhotoStallScale(input) as unknown as unknown[];
    expect(expr.slice(0, 3)).toEqual(["interpolate", ["linear"], ["zoom"]]);
    expect(expr[3]).toBeCloseTo(18.6, 5);
    expect(expr[expr.length - 2]).toBeCloseTo(20, 5);
    expect(expr[expr.length - 1]).toBeCloseTo(1, 5);
  });
});
