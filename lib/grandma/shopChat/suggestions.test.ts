import { describe, expect, it } from "vitest";
import { buildShopChatSuggestions } from "./suggestions";

describe("buildShopChatSuggestions", () => {
  it("データの無いお店は、いつでも答えられる2つだけ", () => {
    expect(buildShopChatSuggestions({ products: [] }).map((s) => s.text)).toEqual(["おすすめはなんですか？"]);
    expect(buildShopChatSuggestions({ products: ["トマト"] }).map((s) => s.text)).toEqual([
      "どんな商品がありますか？",
      "おすすめはなんですか？",
    ]);
  });

  it("支払い・雨の日・場所は、そのお店にデータがあるときだけ出す", () => {
    const texts = buildShopChatSuggestions({
      products: ["トマト"],
      paymentMethods: ["現金"],
      rainPolicy: "テントで出店",
      chome: "三丁目",
    }).map((s) => s.text);
    expect(texts).toContain("支払いは何が使えますか？");
    expect(texts).toContain("雨の日でも出店していますか？");
    expect(texts).toContain("どのあたりにありますか？");
  });

  it("5つまでに絞る", () => {
    const list = buildShopChatSuggestions({
      products: ["a"],
      paymentMethods: ["現金"],
      rainPolicy: "x",
      chome: "一丁目",
      schedule: "毎週",
    });
    expect(list).toHaveLength(5);
  });
});
