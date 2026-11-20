import { describe, expect, it } from "vitest";
import { parseSiteCopyTranslation } from "./translate";

describe("parseSiteCopyTranslation", () => {
  const requested = [{ key: "faq.title", text: "FAQ" }, { key: "landing.x", text: "短い" }];
  it("依頼したキーの英訳だけを残す", () => {
    const out = parseSiteCopyTranslation({ items: [{ key: "faq.title", en: " FAQ " }, { key: "other", en: "x" }, { key: "landing.x", en: "" }] }, requested);
    expect(out).toEqual({ "faq.title": "FAQ" });
  });
  it("極端に長い訳と形の違う返事は捨てる", () => {
    expect(parseSiteCopyTranslation({ items: [{ key: "faq.title", en: "a".repeat(500) }] }, requested)).toEqual({});
    expect(parseSiteCopyTranslation("nope", requested)).toEqual({});
  });
});
