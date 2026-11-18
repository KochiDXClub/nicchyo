import { describe, expect, it } from "vitest";
import {
  SPOT_DESCRIPTION_MAX,
  SPOT_NAME_EN_MAX,
  buildSpotTranslationUserPrompt,
  parseSpotDescriptionEn,
  parseSpotNameEn,
  parseSpotTranslation,
} from "./translate";

describe("parseSpotTranslation", () => {
  it("名前と説明を trim して返し、説明は空でもよい", () => {
    expect(parseSpotTranslation({ name_en: " Kochijo-mae ", description_en: " A tram stop. " })).toEqual({
      nameEn: "Kochijo-mae",
      descriptionEn: "A tram stop.",
    });
    expect(parseSpotTranslation({ name_en: "Restroom", description_en: "" })).toEqual({ nameEn: "Restroom", descriptionEn: "" });
  });

  it("形が違う・名前が空・長すぎるものは捨てる（null）", () => {
    const bad = [
      null,
      "x",
      {},
      { name_en: 1, description_en: "" },
      { name_en: "Food" },
      { name_en: " ", description_en: "" },
      { name_en: "a".repeat(SPOT_NAME_EN_MAX + 1), description_en: "" },
      { name_en: "Food", description_en: "a".repeat(SPOT_DESCRIPTION_MAX + 1) },
    ];
    for (const value of bad) expect(parseSpotTranslation(value)).toBeNull();
  });
});

describe("parseSpotNameEn / parseSpotDescriptionEn", () => {
  it("空・未指定は null（英語版なし）、長すぎる・文字列以外は undefined（不正）", () => {
    expect(parseSpotNameEn(" Restroom ")).toBe("Restroom");
    expect(parseSpotNameEn("")).toBeNull();
    expect(parseSpotNameEn(undefined)).toBeNull();
    expect(parseSpotNameEn(null)).toBeNull();
    expect(parseSpotNameEn("a".repeat(SPOT_NAME_EN_MAX + 1))).toBeUndefined();
    expect(parseSpotNameEn(5)).toBeUndefined();

    expect(parseSpotDescriptionEn(" Plain text. ")).toBe("Plain text.");
    expect(parseSpotDescriptionEn("  ")).toBeNull();
    expect(parseSpotDescriptionEn("a".repeat(SPOT_DESCRIPTION_MAX + 1))).toBeUndefined();
    expect(parseSpotDescriptionEn(false)).toBeUndefined();
  });
});

describe("prompt", () => {
  it("名前と説明は JSON のデータとして渡す", () => {
    const prompt = buildSpotTranslationUserPrompt({ name: "高知城前", description: "電停です" });
    expect(prompt).toContain(JSON.stringify({ name: "高知城前", description: "電停です" }));
  });
});
