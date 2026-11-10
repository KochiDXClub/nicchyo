import { describe, expect, it } from "vitest";

import { normalizeSearchText } from "./normalizeSearchText";

describe("normalizeSearchText", () => {
  it("カタカナをひらがなにそろえる", () => {
    expect(normalizeSearchText("トマト")).toBe("とまと");
  });

  it("半角カタカナ（濁点つき）も、ひらがなにそろえる", () => {
    expect(normalizeSearchText("ｶﾞｲﾄﾞ")).toBe("がいど");
  });

  it("全角英字を半角の小文字にそろえる", () => {
    expect(normalizeSearchText("ＣＢＤ")).toBe("cbd");
  });

  it("長音「ー」はそのまま残す", () => {
    expect(normalizeSearchText("コーヒー")).toBe("こーひー");
  });

  it("英字とカタカナが混ざっていてもそろえる", () => {
    expect(normalizeSearchText("Ｔomato トマト")).toBe("tomato とまと");
  });

  it("空文字は空文字のまま", () => {
    expect(normalizeSearchText("")).toBe("");
  });
});
