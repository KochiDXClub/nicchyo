import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_COPY } from "@/lib/site-copy/content";
import { resolveSiteTexts, siteTextFor } from "./siteCopy";

describe("resolveSiteTexts", () => {
  const key = "faq.title" as const;
  it("英訳は今の日本語と合うときだけ使う", () => {
    const fresh = { ...DEFAULT_SITE_COPY, en: { texts: { [key]: { text: "FAQ (fresh)", source: DEFAULT_SITE_COPY.texts[key] } } } };
    expect(resolveSiteTexts(fresh, "en")[key]).toBe("FAQ (fresh)");
    expect(siteTextFor(key, "en", resolveSiteTexts(fresh, "en"))).toBe("FAQ (fresh)");
    const stale = { ...fresh, texts: { ...DEFAULT_SITE_COPY.texts, [key]: "変更後" } };
    expect(resolveSiteTexts(stale, "en")[key]).toBe("変更後");
  });
  it("日本語のロケールは英訳を使わない", () => {
    const copy = { ...DEFAULT_SITE_COPY, en: { texts: { [key]: { text: "FAQ", source: DEFAULT_SITE_COPY.texts[key] } } } };
    expect(resolveSiteTexts(copy, "ja")[key]).toBe(DEFAULT_SITE_COPY.texts[key]);
  });
});
