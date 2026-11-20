import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_COPY, parseSiteCopy, resolveSiteCopy } from "./content";

describe("site copy validation", () => {
  it("既定値を受け入れ、未知のキー・HTML・空欄を拒否する", () => {
    expect(parseSiteCopy(DEFAULT_SITE_COPY)).not.toBeNull();
    expect(parseSiteCopy({ ...DEFAULT_SITE_COPY, texts: { ...DEFAULT_SITE_COPY.texts, unknown: "x" } })).toBeNull();
    expect(parseSiteCopy({ ...DEFAULT_SITE_COPY, texts: { ...DEFAULT_SITE_COPY.texts, "faq.title": "<script>x</script>" } })).toBeNull();
    expect(parseSiteCopy({ ...DEFAULT_SITE_COPY, faq: [{ id: "a", category: "map", q: "", a: "回答" }] })).toBeNull();
  });
  it("重複するFAQのIDを拒否する", () => {
    expect(parseSiteCopy({ ...DEFAULT_SITE_COPY, faq: [DEFAULT_SITE_COPY.faq[0], DEFAULT_SITE_COPY.faq[0]] })).toBeNull();
  });
  it("新規キーを初期値で補い、保存済みの文言を維持する", () => {
    const saved = { ...DEFAULT_SITE_COPY.texts, "faq.title": "変更後" } as Record<string, string>;
    delete saved["mapIntro.title"];
    const resolved = resolveSiteCopy({ texts: saved, faq: DEFAULT_SITE_COPY.faq });
    expect(resolved?.texts["faq.title"]).toBe("変更後");
    expect(resolved?.texts["mapIntro.title"]).toBe(DEFAULT_SITE_COPY.texts["mapIntro.title"]);
  });
});

describe("site copy English entries", () => {
  it("英訳は保存時に検証し、未知のキーや HTML を拒否する", () => {
    const base = { texts: DEFAULT_SITE_COPY.texts, faq: DEFAULT_SITE_COPY.faq };
    const ok = { "faq.title": { text: "FAQ", source: DEFAULT_SITE_COPY.texts["faq.title"] } };
    expect(parseSiteCopy({ ...base, en: { texts: ok } })?.en?.texts["faq.title"]?.text).toBe("FAQ");
    expect(parseSiteCopy({ ...base, en: { texts: { unknown: { text: "x", source: "y" } } } })).toBeNull();
    expect(parseSiteCopy({ ...base, en: { texts: { "faq.title": { text: "<b>x</b>", source: "y" } } } })).toBeNull();
  });
  it("読み出し時は壊れた英訳だけを捨て、日本語の公開版は残す", () => {
    const base = { texts: DEFAULT_SITE_COPY.texts, faq: DEFAULT_SITE_COPY.faq };
    const resolved = resolveSiteCopy({ ...base, en: { texts: { gone: { text: "x", source: "y" }, "faq.title": { text: "", source: "y" } } } });
    expect(resolved).not.toBeNull();
    expect(resolved?.en).toBeUndefined();
  });
});
