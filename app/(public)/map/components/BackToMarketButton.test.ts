import { describe, expect, it } from "vitest";
import { closestRatioOnSegment, segmentTouchesRect } from "./BackToMarketButton";

const screen = { left: 0, top: 0, right: 390, bottom: 844 };

describe("segmentTouchesRect", () => {
  it("両端が画面の中なら見えている", () => {
    expect(segmentTouchesRect({ x: 10, y: 10 }, { x: 100, y: 200 }, screen)).toBe(true);
  });

  it("両端が画面の外でも、間が画面を横切っていれば見えている（寄っているとき）", () => {
    expect(segmentTouchesRect({ x: 195, y: -500 }, { x: 195, y: 1500 }, screen)).toBe(true);
  });

  it("画面の外を通るだけなら見えていない", () => {
    expect(segmentTouchesRect({ x: -50, y: -500 }, { x: -20, y: 1500 }, screen)).toBe(false);
    expect(segmentTouchesRect({ x: 500, y: 100 }, { x: 900, y: 300 }, screen)).toBe(false);
  });

  it("長さ 0 の線分は点として扱う", () => {
    expect(segmentTouchesRect({ x: 20, y: 20 }, { x: 20, y: 20 }, screen)).toBe(true);
    expect(segmentTouchesRect({ x: -20, y: 20 }, { x: -20, y: 20 }, screen)).toBe(false);
  });
});

describe("closestRatioOnSegment", () => {
  it("線分の途中に垂線を下ろせるならその割合", () => {
    expect(closestRatioOnSegment({ x: 50, y: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBeCloseTo(0.5);
  });

  it("線分の外側なら端に寄せる", () => {
    expect(closestRatioOnSegment({ x: -30, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(0);
    expect(closestRatioOnSegment({ x: 300, y: 5 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(1);
  });
});
