import { describe, expect, it } from "vitest";
import { isEquirectangularPhoto } from "./panorama";

describe("isEquirectangularPhoto", () => {
  it("横:縦が 2:1 の大きな画像は全周写真とみなす", () => {
    expect(isEquirectangularPhoto(4096, 2048)).toBe(true);
    expect(isEquirectangularPhoto(5760, 2880)).toBe(true);
  });

  it("多少のずれ（リサイズの丸め）は許す", () => {
    expect(isEquirectangularPhoto(4096, 2050)).toBe(true);
  });

  it("普通の写真は全周写真ではない", () => {
    expect(isEquirectangularPhoto(4000, 3000)).toBe(false);
    expect(isEquirectangularPhoto(1920, 1080)).toBe(false);
    expect(isEquirectangularPhoto(3000, 4000)).toBe(false);
  });

  it("小さい画像は 2:1 でも対象にしない", () => {
    expect(isEquirectangularPhoto(800, 400)).toBe(false);
  });

  it("大きさが分からないときは false", () => {
    expect(isEquirectangularPhoto(0, 0)).toBe(false);
    expect(isEquirectangularPhoto(NaN, 100)).toBe(false);
  });
});
