import { describe, expect, it } from "vitest";
import { sumPostStats, toPostStats } from "./postStats";

describe("toPostStats", () => {
  it("投稿ごとに見た人とハートをまとめ、数が無い投稿は 0 にする", () => {
    const stats = toPostStats(
      ["a", "b"],
      [{ vendor_content_id: "a", cnt: "12" }],
      [
        { vendor_content_id: "a", cnt: 3 },
        { vendor_content_id: "b", cnt: 1 },
      ]
    );
    expect(stats).toEqual({ a: { views: 12, hearts: 3 }, b: { views: 0, hearts: 1 } });
  });

  it("頼んでいない投稿の行は混ぜない", () => {
    expect(toPostStats(["a"], [{ vendor_content_id: "x", cnt: 9 }], [])).toEqual({ a: { views: 0, hearts: 0 } });
  });
});

describe("sumPostStats", () => {
  it("合計する（数が無いものは 0 として扱う）", () => {
    expect(sumPostStats([{ views: 2, hearts: 1 }, undefined, { views: 3, hearts: 0 }])).toEqual({ views: 5, hearts: 1 });
  });
});
