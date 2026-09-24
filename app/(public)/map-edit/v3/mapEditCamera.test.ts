import { describe, it, expect } from "vitest";
import {
  MAPLIBRE_ZOOMS,
  bearingToRotation,
  nearestZoomIdx,
  rotationToBearing,
  zoomIdxToMapLibreZoom,
} from "./mapEditCamera";

describe("MAPLIBRE_ZOOMS", () => {
  it("旧 ZOOMS=[1.2,3.5,12] に対応する、増加する3段階のズーム値を持つ", () => {
    expect(MAPLIBRE_ZOOMS).toHaveLength(3);
    expect(MAPLIBRE_ZOOMS[0]).toBeLessThan(MAPLIBRE_ZOOMS[1]);
    expect(MAPLIBRE_ZOOMS[1]).toBeLessThan(MAPLIBRE_ZOOMS[2]);
    // 公開マップの表示範囲（zoom 14〜20、MapViewMapLibre.tsx の ZOOM_OFFSET 込み）に収まる
    expect(MAPLIBRE_ZOOMS[0]).toBeGreaterThan(14);
    expect(MAPLIBRE_ZOOMS[2]).toBeLessThan(21);
  });
});

describe("zoomIdxToMapLibreZoom / nearestZoomIdx", () => {
  it("各 zoomIdx を対応する MAPLIBRE_ZOOMS の値に変換する", () => {
    expect(zoomIdxToMapLibreZoom(0)).toBe(MAPLIBRE_ZOOMS[0]);
    expect(zoomIdxToMapLibreZoom(1)).toBe(MAPLIBRE_ZOOMS[1]);
    expect(zoomIdxToMapLibreZoom(2)).toBe(MAPLIBRE_ZOOMS[2]);
  });

  it("範囲外のインデックスは端に丸める", () => {
    expect(zoomIdxToMapLibreZoom(-1)).toBe(MAPLIBRE_ZOOMS[0]);
    expect(zoomIdxToMapLibreZoom(5)).toBe(MAPLIBRE_ZOOMS[2]);
  });

  it("ちょうど段階の値では nearestZoomIdx の逆変換になる", () => {
    MAPLIBRE_ZOOMS.forEach((zoom, idx) => {
      expect(nearestZoomIdx(zoom)).toBe(idx);
    });
  });

  it("連続的なズーム値を最も近い段階に丸める", () => {
    const midway = (MAPLIBRE_ZOOMS[0] + MAPLIBRE_ZOOMS[1]) / 2;
    expect(nearestZoomIdx(midway - 0.01)).toBe(0);
    expect(nearestZoomIdx(midway + 0.01)).toBe(1);
  });
});

describe("rotationToBearing / bearingToRotation", () => {
  it("符号を反転する", () => {
    expect(rotationToBearing(30)).toBe(-30);
    expect(rotationToBearing(-90)).toBe(90);
    expect(bearingToRotation(30)).toBe(-30);
    expect(bearingToRotation(-90)).toBe(90);
  });

  it("往復すると元の値に戻る", () => {
    expect(bearingToRotation(rotationToBearing(42))).toBe(42);
    expect(rotationToBearing(bearingToRotation(-17))).toBe(-17);
  });

  it("0 はそのまま変わらない", () => {
    expect(rotationToBearing(0)).toBe(-0);
    expect(bearingToRotation(0)).toBe(-0);
  });
});
