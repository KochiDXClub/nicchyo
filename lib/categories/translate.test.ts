import { describe, expect, it } from "vitest";
import { buildCategoryTranslationUserPrompt, parseCategoryNameEn, parseCategoryTranslation } from "./translate";

describe("parseCategoryTranslation", () => {
  it("名前を trim して返し、形が違う・空・長すぎるものは捨てる", () => {
    expect(parseCategoryTranslation({ name: " Food " })).toBe("Food");
    for (const bad of [null, "x", {}, { name: 1 }, { name: " " }, { name: "a".repeat(101) }]) {
      expect(parseCategoryTranslation(bad)).toBeNull();
    }
  });
});

describe("parseCategoryNameEn", () => {
  it("空・未指定は null（英語名なし）、長すぎる・文字列以外は undefined（不正）", () => {
    expect(parseCategoryNameEn(" Food ")).toBe("Food");
    expect(parseCategoryNameEn("")).toBeNull();
    expect(parseCategoryNameEn(undefined)).toBeNull();
    expect(parseCategoryNameEn(null)).toBeNull();
    expect(parseCategoryNameEn("a".repeat(101))).toBeUndefined();
    expect(parseCategoryNameEn(5)).toBeUndefined();
  });
});

describe("prompt", () => {
  it("名前は JSON のデータとして渡す", () => {
    expect(buildCategoryTranslationUserPrompt("食べ物")).toContain(JSON.stringify({ name: "食べ物" }));
  });
});
