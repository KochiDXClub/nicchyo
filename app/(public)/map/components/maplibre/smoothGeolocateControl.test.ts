import { describe, expect, it } from "vitest";

import { getAnimationDurationMs, interpolateLatLng } from "./smoothGeolocateControl";

describe("getAnimationDurationMs", () => {
  it("位置が届く間隔をかけて動かす", () => {
    expect(getAnimationDurationMs(1000, 2)).toBe(1000);
  });
  it("短すぎ・長すぎは丸める", () => {
    expect(getAnimationDurationMs(50, 2)).toBe(300);
    expect(getAnimationDurationMs(10000, 2)).toBe(1500);
  });
  it("大きく飛んだときや不正な間隔は動かさない", () => {
    expect(getAnimationDurationMs(1000, 500)).toBe(0);
    expect(getAnimationDurationMs(0, 2)).toBe(0);
    expect(getAnimationDurationMs(Number.NaN, 2)).toBe(0);
  });
});

describe("interpolateLatLng", () => {
  it("途中の位置を返し、範囲外は端に丸める", () => {
    const a = { lat: 0, lng: 0 };
    const b = { lat: 2, lng: 4 };
    expect(interpolateLatLng(a, b, 0.5)).toEqual({ lat: 1, lng: 2 });
    expect(interpolateLatLng(a, b, 2)).toEqual(b);
    expect(interpolateLatLng(a, b, -1)).toEqual(a);
  });
});
