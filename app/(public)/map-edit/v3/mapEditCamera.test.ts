import { describe, it, expect } from "vitest";
import {
  MAPLIBRE_ZOOMS,
  bearingToRotation,
  nearestZoomIdx,
  rotationToBearing,
  zoomIdxToMapLibreZoom,
} from "./mapEditCamera";

describe("MAPLIBRE_ZOOMS", () => {
  it("has 3 increasing zoom values matching the old ZOOMS=[1.2,3.5,12] progression", () => {
    expect(MAPLIBRE_ZOOMS).toHaveLength(3);
    expect(MAPLIBRE_ZOOMS[0]).toBeLessThan(MAPLIBRE_ZOOMS[1]);
    expect(MAPLIBRE_ZOOMS[1]).toBeLessThan(MAPLIBRE_ZOOMS[2]);
    // 公開マップの表示範囲（zoom 14〜20、MapViewMapLibre.tsx の ZOOM_OFFSET 込み）に収まる
    expect(MAPLIBRE_ZOOMS[0]).toBeGreaterThan(14);
    expect(MAPLIBRE_ZOOMS[2]).toBeLessThan(21);
  });
});

describe("zoomIdxToMapLibreZoom / nearestZoomIdx", () => {
  it("maps each zoomIdx to the corresponding MAPLIBRE_ZOOMS entry", () => {
    expect(zoomIdxToMapLibreZoom(0)).toBe(MAPLIBRE_ZOOMS[0]);
    expect(zoomIdxToMapLibreZoom(1)).toBe(MAPLIBRE_ZOOMS[1]);
    expect(zoomIdxToMapLibreZoom(2)).toBe(MAPLIBRE_ZOOMS[2]);
  });

  it("clamps out-of-range indices to the nearest end", () => {
    expect(zoomIdxToMapLibreZoom(-1)).toBe(MAPLIBRE_ZOOMS[0]);
    expect(zoomIdxToMapLibreZoom(5)).toBe(MAPLIBRE_ZOOMS[2]);
  });

  it("is the inverse of nearestZoomIdx for exact bucket values", () => {
    MAPLIBRE_ZOOMS.forEach((zoom, idx) => {
      expect(nearestZoomIdx(zoom)).toBe(idx);
    });
  });

  it("rounds a continuous zoom value to its nearest bucket", () => {
    const midway = (MAPLIBRE_ZOOMS[0] + MAPLIBRE_ZOOMS[1]) / 2;
    expect(nearestZoomIdx(midway - 0.01)).toBe(0);
    expect(nearestZoomIdx(midway + 0.01)).toBe(1);
  });
});

describe("rotationToBearing / bearingToRotation", () => {
  it("flips the sign", () => {
    expect(rotationToBearing(30)).toBe(-30);
    expect(rotationToBearing(-90)).toBe(90);
    expect(bearingToRotation(30)).toBe(-30);
    expect(bearingToRotation(-90)).toBe(90);
  });

  it("round-trips back to the original value", () => {
    expect(bearingToRotation(rotationToBearing(42))).toBe(42);
    expect(rotationToBearing(bearingToRotation(-17))).toBe(-17);
  });

  it("leaves 0 unchanged", () => {
    expect(rotationToBearing(0)).toBe(-0);
    expect(bearingToRotation(0)).toBe(-0);
  });
});
