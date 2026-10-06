import { describe, expect, it } from "vitest";
import { VENDOR_TOUR_PAGES, findVendorTourFeature, findVendorTourPage, isVendorTourKey } from "./tours";

const FEATURES = VENDOR_TOUR_PAGES.flatMap((page) => page.features);

describe("VENDOR_TOUR_PAGES", () => {
  it("画面と、機能の key が重ならない", () => {
    expect(new Set(VENDOR_TOUR_PAGES.map((page) => page.path)).size).toBe(VENDOR_TOUR_PAGES.length);
    expect(new Set(FEATURES.map((feature) => feature.key)).size).toBe(FEATURES.length);
  });

  it("key は DB の形（英小文字・数字・ハイフン、40字まで）に収まる", () => {
    for (const feature of FEATURES) expect(feature.key).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
  });

  it("どの画面にも機能があり、どの機能にもスライドがある", () => {
    for (const page of VENDOR_TOUR_PAGES) expect(page.features.length).toBeGreaterThan(0);
    for (const feature of FEATURES) {
      expect(feature.name.trim()).not.toBe("");
      expect(feature.slides.length).toBeGreaterThan(0);
    }
  });

  it("説明の長さは1画面で3枚まで（枚数を増やさず、1枚の中身で伝える）", () => {
    for (const page of VENDOR_TOUR_PAGES) {
      const slides = page.features.reduce((sum, feature) => sum + feature.slides.length, 0);
      expect(slides).toBeLessThanOrEqual(3);
    }
  });

  it("どのスライドにも見出し・本文・字幕がある", () => {
    for (const feature of FEATURES) {
      for (const slide of feature.slides) {
        expect(slide.title.trim()).not.toBe("");
        expect(slide.body.trim()).not.toBe("");
        expect(slide.captions.length).toBeGreaterThanOrEqual(2);
        for (const caption of slide.captions) expect(caption.trim()).not.toBe("");
        expect(new Set(slide.captions).size).toBe(slide.captions.length);
      }
    }
  });
});

describe("findVendorTourPage", () => {
  it("画面の説明を返す（末尾の / は無視する）", () => {
    expect(findVendorTourPage("/vendor/posts")?.features[0].key).toBe("post-new");
    expect(findVendorTourPage("/my-shop/schedule/")?.features[0].key).toBe("schedule");
  });

  it("出店者トップには3つの機能がある", () => {
    expect(findVendorTourPage("/my-shop")?.features.map((feature) => feature.key)).toEqual([
      "home-chat",
      "home-actions",
      "home-calendar",
    ]);
  });

  it("説明のない画面や、パスが無いときは null", () => {
    expect(findVendorTourPage("/vendor/help")).toBeNull();
    expect(findVendorTourPage("/my-shop/ask")).toBeNull();
    expect(findVendorTourPage(null)).toBeNull();
  });
});

describe("findVendorTourFeature / isVendorTourKey", () => {
  it("機能の key から機能を返し、知らない key は返さない", () => {
    expect(findVendorTourFeature("home-calendar")?.name).toBe("お休みカレンダー");
    expect(findVendorTourFeature("unknown")).toBeNull();
  });

  it("知っている key だけ通す", () => {
    expect(isVendorTourKey("home-chat")).toBe(true);
    expect(isVendorTourKey("home")).toBe(false);
    expect(isVendorTourKey(123)).toBe(false);
  });
});
