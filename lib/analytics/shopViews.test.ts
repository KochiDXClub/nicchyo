import { describe, expect, it } from "vitest";
import { sourceFromReferrer } from "./shopViews";

const ORIGIN = "https://nicchyo.example";

describe("sourceFromReferrer", () => {
  it("同じサイトの検索ページから来たら search、地図から来たら map", () => {
    expect(sourceFromReferrer(`${ORIGIN}/search?q=いも`, ORIGIN)).toBe("search");
    expect(sourceFromReferrer(`${ORIGIN}/map?shop=001`, ORIGIN)).toBe("map");
  });

  it("前のページが無い・ほかのサイト・読めない値は direct（QR や共有リンクなど）", () => {
    expect(sourceFromReferrer("", ORIGIN)).toBe("direct");
    expect(sourceFromReferrer("https://example.com/search", ORIGIN)).toBe("direct");
    expect(sourceFromReferrer("not a url", ORIGIN)).toBe("direct");
  });
});
