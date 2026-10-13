import { describe, expect, it } from "vitest";
import { CHOMES, getChome, isOutsideReferenceRange, normalizeChomeId } from "./chomes";

describe("normalizeChomeId", () => {
  it.each([
    ["3", 3],
    ["３", 3],
    ["3丁目", 3],
    ["３丁目", 3],
    ["三丁目", 3],
    ["日曜市3丁目", 3],
    ["日曜市 三丁目", 3],
    [" 7 ", 7],
    ["一丁目", 1],
  ])("%s → %s", (input, expected) => {
    expect(normalizeChomeId(input)).toBe(expected);
  });

  it.each(["", "  ", "0", "8", "八丁目", "10", "1・2", "追手筋", "日曜市", null, undefined])(
    "判定できない値 %s は null",
    (input) => {
      expect(normalizeChomeId(input)).toBeNull();
    },
  );
});

describe("CHOMES", () => {
  it("1〜7 が順に並び、表示名が揃っている", () => {
    expect(CHOMES.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const c of CHOMES) {
      expect(c.name).toBe(`日曜市${c.id}丁目`);
      expect(c.shortName).toBe(`${c.id}丁目`);
    }
  });

  it("7丁目だけ大橋通り", () => {
    expect(CHOMES.filter((c) => c.roadName === "大橋通り").map((c) => c.id)).toEqual([7]);
  });

  it("getChome", () => {
    expect(getChome(4)?.shortName).toBe("4丁目");
    expect(getChome(8)).toBeNull();
    expect(getChome(null)).toBeNull();
  });
});

describe("isOutsideReferenceRange", () => {
  it("範囲内は警告しない", () => {
    expect(isOutsideReferenceRange(3, 204)).toBe(false);
  });
  it("範囲外は警告する", () => {
    expect(isOutsideReferenceRange(3, 300)).toBe(true);
    expect(isOutsideReferenceRange(1, 88)).toBe(false);
    expect(isOutsideReferenceRange(1, 89)).toBe(true);
  });
});
