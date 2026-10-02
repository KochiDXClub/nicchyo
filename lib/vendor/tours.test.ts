import { describe, expect, it } from "vitest";
import { VENDOR_TOURS, findVendorTour, isVendorTourKey } from "./tours";

describe("VENDOR_TOURS", () => {
  it("key と画面が重ならない", () => {
    expect(new Set(VENDOR_TOURS.map((tour) => tour.key)).size).toBe(VENDOR_TOURS.length);
    expect(new Set(VENDOR_TOURS.map((tour) => tour.path)).size).toBe(VENDOR_TOURS.length);
  });

  it("key は DB の形（英小文字・数字・ハイフン、40字まで）に収まる", () => {
    for (const tour of VENDOR_TOURS) expect(tour.key).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
  });

  it("どの説明も1〜3枚で、見出しと本文がある", () => {
    for (const tour of VENDOR_TOURS) {
      expect(tour.slides.length).toBeGreaterThanOrEqual(1);
      expect(tour.slides.length).toBeLessThanOrEqual(3);
      for (const slide of tour.slides) {
        expect(slide.title.trim()).not.toBe("");
        expect(slide.body.trim()).not.toBe("");
      }
    }
  });
});

describe("findVendorTour", () => {
  it("画面の説明を返す（末尾の / は無視する）", () => {
    expect(findVendorTour("/vendor/post/new")?.key).toBe("post-new");
    expect(findVendorTour("/my-shop/schedule/")?.key).toBe("schedule");
  });

  it("説明のない画面や、パスが無いときは null", () => {
    expect(findVendorTour("/vendor/help")).toBeNull();
    expect(findVendorTour("/my-shop/ask")).toBeNull();
    expect(findVendorTour(null)).toBeNull();
  });
});

describe("isVendorTourKey", () => {
  it("知っている key だけ通す", () => {
    expect(isVendorTourKey("home")).toBe(true);
    expect(isVendorTourKey("unknown")).toBe(false);
    expect(isVendorTourKey(123)).toBe(false);
  });
});
