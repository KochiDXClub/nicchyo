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
