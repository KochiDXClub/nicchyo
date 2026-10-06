import { describe, expect, it } from "vitest";
import { parseMainProducts } from "./SlotVendorPanel";

describe("parseMainProducts", () => {
  it("読点・カンマ・改行で区切り、空の項目を除く", () => {
    expect(parseMainProducts("柚子、文旦, 生姜，\n  田舎寿司 、、")).toEqual(["柚子", "文旦", "生姜", "田舎寿司"]);
  });

  it("上限の件数までにする", () => {
    expect(parseMainProducts(Array.from({ length: 12 }, (_, i) => `品${i}`).join("、"))).toHaveLength(10);
  });
});
