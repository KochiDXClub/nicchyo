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

  it("スマホで next/image が縮小した大きさ（828・1200px 幅）でも判定できる", () => {
    expect(isEquirectangularPhoto(828, 414)).toBe(true);
    expect(isEquirectangularPhoto(1200, 600)).toBe(true);
    expect(isEquirectangularPhoto(640, 320)).toBe(true);
  });

  it("軽量化した画像（1200px 幅の WebP）やサムネイル（400px 幅）でも判定できる", () => {
    expect(isEquirectangularPhoto(1200, 600)).toBe(true);
    expect(isEquirectangularPhoto(1200, 598)).toBe(true);
    expect(isEquirectangularPhoto(400, 200)).toBe(true);
    // 400px 幅に収めた普通の写真（4:3）は対象外
    expect(isEquirectangularPhoto(400, 300)).toBe(false);
  });

  it("極端に小さい画像は 2:1 でも対象にしない", () => {
    expect(isEquirectangularPhoto(32, 16)).toBe(false);
  });

  it("大きさが分からないときは false", () => {
    expect(isEquirectangularPhoto(0, 0)).toBe(false);
    expect(isEquirectangularPhoto(NaN, 100)).toBe(false);
  });
});
