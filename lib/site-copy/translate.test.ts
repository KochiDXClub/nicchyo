import { describe, expect, it } from "vitest";
import { chunkSiteCopyItems, parseSiteCopyTranslation } from "./translate";

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

describe("chunkSiteCopyItems", () => {
  it("件数の上限で分け、上限を超える区分も全部の文言を残す", () => {
    const items = Array.from({ length: 75 }, (_, i) => ({ key: `about.${i}`, text: "短い文" }));
    const chunks = chunkSiteCopyItems(items, 60, 20000);
    expect(chunks.map((c) => c.length)).toEqual([60, 15]);
    expect(chunks.flat()).toEqual(items);
  });
  it("文字数の上限で分ける", () => {
    const items = [{ key: "a", text: "x".repeat(15) }, { key: "b", text: "x".repeat(15) }, { key: "c", text: "x".repeat(5) }];
    expect(chunkSiteCopyItems(items, 60, 20).map((c) => c.map((i) => i.key))).toEqual([["a"], ["b", "c"]]);
  });
  it("空なら依頼を作らない", () => {
    expect(chunkSiteCopyItems([])).toEqual([]);
  });
});
