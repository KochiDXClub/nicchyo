import { describe, expect, it } from "vitest";
import texts from "@/content/site-copy/texts.json";
import enTexts from "@/content/i18n/en.json";
import { siteTextFor } from "./siteCopy";

describe("siteTextFor", () => {
  it("英訳のキーは、すべてシートの文言に存在する（シートでキーを消したり変えたりしたら気づく）", () => {
    const orphaned = Object.keys(enTexts).filter((key) => !(key in texts));
    expect(orphaned).toEqual([]);
  });

  it("訳が無い文言と日本語は原文に戻る", () => {
    const key = Object.keys(texts)[0] as keyof typeof texts;
    expect(siteTextFor(key, "ja")).toBe(texts[key]);
  });
});
