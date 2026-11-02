import { describe, expect, it } from "vitest";
import { countSearchKeywords } from "./searchTrends.server";

describe("countSearchKeywords", () => {
  it("前後の空白と大文字小文字をそろえて、回数の多い順に並べる", () => {
    expect(
      countSearchKeywords(["トマト", " トマト ", "Tomato", "tomato", "いも", "いも", "トマト"])
    ).toEqual([
      { keyword: "トマト", count: 3 },
      { keyword: "tomato", count: 2 },
      { keyword: "いも", count: 2 },
    ]);
  });

  it("1文字・空の語は数えない", () => {
    expect(countSearchKeywords(["あ", "あ", "", "   ", "いも", "いも"])).toEqual([{ keyword: "いも", count: 2 }]);
  });

  // 1人が1回だけ打った語（名前・電話番号など）を、検索の少ない週に上位へ出さない
  it("1回しか検索されていない語は出さない", () => {
    expect(countSearchKeywords(["山田花子", "090-1234-5678", "トマト", "トマト"])).toEqual([
      { keyword: "トマト", count: 2 },
    ]);
  });

  it("normalize を渡すと、それでそろえてから数える（短くなりすぎた語は数えない）", () => {
    const stripBrackets = (raw: string) => raw.replace(/[「」]/g, "").trim();
    expect(countSearchKeywords(["「トマト」", "トマト", "「あ」", "「あ」"], stripBrackets)).toEqual([
      { keyword: "トマト", count: 2 },
    ]);
  });
});
