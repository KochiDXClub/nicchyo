import { describe, expect, it } from "vitest";
import {
  buildPhotoStallScale,
  photoStallScaleAt,
  stallScaleAt,
  type PhotoStallScaleInput,
} from "./photoStallScale";

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

describe("最大ズームより先の一段（detail）", () => {
  const detail: PhotoStallScaleInput = { ...input, detailOffset: 1, detailScale: 2 };

  it("指定しなければ最大ズームで頭打ち（従来どおり）", () => {
    expect(stallScaleAt(0.5, input)).toBe(1);
    expect(photoStallScaleAt(0.5, input)).toBeCloseTo(1, 5);
  });

  it("通常の屋台は一段先で detailScale 倍になる", () => {
    expect(stallScaleAt(0, detail)).toBe(1);
    expect(stallScaleAt(0.5, detail)).toBeCloseTo(1.5, 5);
    expect(stallScaleAt(1, detail)).toBeCloseTo(2, 5);
    expect(stallScaleAt(1.5, detail)).toBeCloseTo(2, 5);
  });

  it("写真入りも一段先で 2 倍になり、stops の値は店舗間隔の 92% に収まる", () => {
    expect(photoStallScaleAt(1, detail)).toBeCloseTo(2, 5);
    for (let offset = 0; offset <= 1; offset += 0.1) {
      const spacing = 95 * 2 ** offset;
      expect(photoStallScaleAt(offset, detail) * 84).toBeLessThanOrEqual(spacing * 0.92 + 1e-6);
    }
  });

  it("寄るほど大きくなる（単調）", () => {
    let prev = 0;
    for (let offset = -1.4; offset <= 1; offset += 0.1) {
      const v = photoStallScaleAt(offset, detail);
      expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = v;
    }
  });

  it("stops は一段先のズームまで伸びる", () => {
    const expr = buildPhotoStallScale(detail) as unknown as unknown[];
    expect(expr[3]).toBeCloseTo(18.6, 5);
    expect(expr[expr.length - 2]).toBeCloseTo(21, 5);
    expect(expr[expr.length - 1]).toBeCloseTo(2, 5);
  });

  it("描画時の補間（整数ズームの値どうしを直線で結ぶ）でも、一段先までのあいだに店舗間隔を超えない", () => {
    const at20 = photoStallScaleAt(0, detail);
    const at21 = photoStallScaleAt(1, detail);
    for (let t = 0; t <= 1; t += 0.1) {
      const rendered = (at20 + (at21 - at20) * t) * 84;
      expect(rendered).toBeLessThanOrEqual(95 * 2 ** t);
    }
  });
});
