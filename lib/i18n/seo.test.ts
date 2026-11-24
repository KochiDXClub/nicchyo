import { describe, expect, it } from "vitest";
import {
  EN_INDEXABLE_PATHS,
  englishAlternateLanguages,
  englishRobotsFor,
  isEnglishIndexable,
  withEnglishSitemapVersions,
} from "./seo";

const SITE = "https://nicchyo.jp";

describe("英語版の索引（seo）", () => {
  it("初期状態では英語版を索引するページがない（すべての /en/ は noindex）", () => {
    expect(EN_INDEXABLE_PATHS).toEqual([]);
    expect(isEnglishIndexable("/en/map")).toBe(false);
    expect(englishRobotsFor("en", "/map")).toEqual({ index: false, follow: true });
    expect(englishRobotsFor("en", "/")).toEqual({ index: false, follow: true });
    expect(englishRobotsFor("ja", "/map")).toBeUndefined();
    expect(englishAlternateLanguages("/map")).toBeUndefined();
  });

  it("索引を許したページだけ、英語版の noindex を外し hreflang を出す", () => {
    const list = ["/map", "/"];
    expect(isEnglishIndexable("/en/map/", list)).toBe(true);
    expect(isEnglishIndexable("/en/faq", list)).toBe(false);
    expect(englishRobotsFor("en", "/map", list)).toBeUndefined();
    expect(englishRobotsFor("en", "/faq", list)).toEqual({ index: false, follow: true });
    expect(englishRobotsFor("ja", "/faq", list)).toBeUndefined();
    expect(englishAlternateLanguages("/en/map", list)).toEqual({ ja: "/map", en: "/en/map", "x-default": "/map" });
    expect(englishAlternateLanguages("/map?utm_source=x", list)).toEqual({ ja: "/map", en: "/en/map", "x-default": "/map" });
    expect(englishAlternateLanguages("/en", list)).toEqual({ ja: "/", en: "/en", "x-default": "/" });
    expect(englishAlternateLanguages("/faq", list)).toBeUndefined();
  });

  it("sitemap: 対象のページだけ英語のURLを足し、両方に言語別URLを付ける", () => {
    const entries = [
      { url: `${SITE}/map`, changeFrequency: "daily" as const, priority: 1 },
      { url: `${SITE}/faq`, changeFrequency: "monthly" as const, priority: 0.5 },
    ];
    expect(withEnglishSitemapVersions(entries, SITE, [])).toEqual(entries);

    const result = withEnglishSitemapVersions(entries, SITE, ["/map"]);
    expect(result.map((e) => e.url)).toEqual([`${SITE}/map`, `${SITE}/en/map`, `${SITE}/faq`]);
    const langs = { ja: `${SITE}/map`, en: `${SITE}/en/map`, "x-default": `${SITE}/map` };
    expect(result[0]?.alternates).toEqual({ languages: langs });
    expect(result[1]?.alternates).toEqual({ languages: langs });
    expect(result[2]?.alternates).toBeUndefined();
  });
});
