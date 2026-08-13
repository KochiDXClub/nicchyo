import { describe, it, expect } from "vitest";
import { normalizeRotationDeg, unrotateScreenDelta } from "./MapEditCanvas";

describe("unrotateScreenDelta", () => {
  it("returns the same vector when rotation is 0", () => {
    expect(unrotateScreenDelta(10, -4, 0)).toEqual({ x: 10, y: -4 });
  });

  it("preserves vector length regardless of rotation", () => {
    const { x, y } = unrotateScreenDelta(12, 5, 37);
    expect(Math.hypot(x, y)).toBeCloseTo(Math.hypot(12, 5), 6);
  });

  it("maps a rightward screen drag to +x world movement at 0deg", () => {
    expect(unrotateScreenDelta(10, 0, 0)).toEqual({ x: 10, y: 0 });
  });

  it("rotates the screen vector by -rotationDeg into world space", () => {
    // rotation=90deg: 画面右方向のドラッグは、回転前のワールド座標系では
    // 北方向（ローカル座標のy軸負方向）への移動に対応する
    const { x, y } = unrotateScreenDelta(10, 0, 90);
    expect(x).toBeCloseTo(0, 6);
    expect(y).toBeCloseTo(-10, 6);
  });

  it("is the inverse of a rotation by the same angle", () => {
    const rotated = unrotateScreenDelta(8, -3, 42);
    const back = unrotateScreenDelta(rotated.x, rotated.y, -42);
    expect(back.x).toBeCloseTo(8, 6);
    expect(back.y).toBeCloseTo(-3, 6);
  });
});

describe("normalizeRotationDeg", () => {
  it("leaves values already within (-180, 180] unchanged", () => {
    expect(normalizeRotationDeg(0)).toBe(0);
    expect(normalizeRotationDeg(90)).toBe(90);
    expect(normalizeRotationDeg(-90)).toBe(-90);
    expect(normalizeRotationDeg(180)).toBe(180);
  });

  it("wraps values accumulated past 180 back into range", () => {
    // 右へ10度を20回タップ = 200度 は -160度と同じ向き
    expect(normalizeRotationDeg(200)).toBe(-160);
  });

  it("wraps values accumulated past -180 back into range", () => {
    expect(normalizeRotationDeg(-200)).toBe(160);
  });

  it("handles repeated accumulation matching the tap-to-add UI behavior", () => {
    // 右10を2回、右20相当（+10ではなく+30ボタン）を1回で合計40度
    let rotation = 0;
    rotation = normalizeRotationDeg(rotation + 10);
    rotation = normalizeRotationDeg(rotation + 10);
    rotation = normalizeRotationDeg(rotation + 20);
    expect(rotation).toBe(40);
  });
});
