import { describe, expect, it } from "vitest";
import { normalizePanoramaCenter, panoramaThumbGeometry } from "./panoramaThumb";

describe("panoramaThumbGeometry", () => {
  it("中央を選ぶと、高さも左右も写真の真ん中を、4:3で切る", () => {
    expect(panoramaThumbGeometry(2400, 1200, 0.5)).toEqual({
      sy: 375,
      sh: 450,
      outWidth: 600,
      outHeight: 450,
      segments: [{ sx: 900, sw: 600, dx: 0, dw: 600 }],
    });
  });

  it("左端の近くを選ぶと、右端へ回って2つに分けて切る（全周はつながっている）", () => {
    const { segments, outWidth } = panoramaThumbGeometry(2400, 1200, 0);
    expect(segments).toEqual([
      { sx: 2100, sw: 300, dx: 0, dw: 300 },
      { sx: 0, sw: 300, dx: 300, dw: 300 },
    ]);
    expect(segments.reduce((sum, s) => sum + s.dw, 0)).toBe(outWidth);
  });

  it("右端の近くを選んでも、2つで元の幅を満たす", () => {
    const { segments } = panoramaThumbGeometry(2400, 1200, 0.95);
    expect(segments.reduce((sum, s) => sum + s.sw, 0)).toBe(600);
    expect(segments.every((s) => s.sx >= 0 && s.sx + s.sw <= 2400)).toBe(true);
  });

  it("元の写真が大きくても、サムネイルの幅は上限（800px）に収める", () => {
    const { outWidth, outHeight } = panoramaThumbGeometry(6000, 3000, 0.5);
    expect([outWidth, outHeight]).toEqual([800, 600]);
  });

  it("縦が足りない写真では、取れる高さにとどめる", () => {
    const { sy, sh } = panoramaThumbGeometry(2400, 300, 0.5);
    expect([sy, sh]).toEqual([0, 300]);
  });
});

describe("normalizePanoramaCenter", () => {
  it("範囲の外は反対側へ回し、数でなければ中央にする", () => {
    expect(normalizePanoramaCenter(1.25)).toBeCloseTo(0.25);
    expect(normalizePanoramaCenter(-0.25)).toBeCloseTo(0.75);
    expect(normalizePanoramaCenter(Number.NaN)).toBe(0.5);
  });
});
