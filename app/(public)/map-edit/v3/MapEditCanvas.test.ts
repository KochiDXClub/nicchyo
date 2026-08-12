import { describe, it, expect } from "vitest";
import { unrotateScreenDelta } from "./MapEditCanvas";

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
