import { describe, expect, it } from "vitest";
import { englishState } from "./translationState";

const base = { title: "雨天中止", body: "中止です", titleEn: "", bodyEn: "", translatedFrom: null };

describe("englishState", () => {
  it("英語が空なら none", () => {
    expect(englishState(base)).toBe("none");
    expect(englishState({ ...base, titleEn: " ", bodyEn: " " })).toBe("none");
  });

  it("訳したときの日本語のままなら fresh、直していたら stale", () => {
    const en = { ...base, titleEn: "Cancelled", bodyEn: "Cancelled due to rain", translatedFrom: { title: "雨天中止", body: "中止です" } };
    expect(englishState(en)).toBe("fresh");
    expect(englishState({ ...en, body: "中止です。ご注意ください" })).toBe("stale");
    expect(englishState({ ...en, title: "雨天のため中止" })).toBe("stale");
  });

  it("前後の空白だけの違いは stale にしない（保存時に trim されるため）", () => {
    const en = { ...base, titleEn: "a", bodyEn: "b", translatedFrom: { title: "雨天中止", body: "中止です" } };
    expect(englishState({ ...en, body: "中止です\n" })).toBe("fresh");
  });
});
