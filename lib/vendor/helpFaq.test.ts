import { describe, expect, it } from "vitest";
import { VENDOR_FAQ, VENDOR_FAQ_CATEGORIES } from "./helpFaq";

describe("VENDOR_FAQ", () => {
  it("id が重ならない", () => {
    expect(new Set(VENDOR_FAQ.map((item) => item.id)).size).toBe(VENDOR_FAQ.length);
  });

  it("どの質問も、決まったカテゴリに入っている", () => {
    const ids = VENDOR_FAQ_CATEGORIES.map((category) => category.id);
    for (const item of VENDOR_FAQ) expect(ids).toContain(item.category);
  });

  it("質問のないカテゴリは作らない", () => {
    for (const category of VENDOR_FAQ_CATEGORIES) {
      expect(VENDOR_FAQ.some((item) => item.category === category.id)).toBe(true);
    }
  });
});
