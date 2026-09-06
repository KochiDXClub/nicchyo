import { describe, it, expect } from "vitest";
import { buildShopChatSystemPrompt } from "./shopChatPrompt";

describe("buildShopChatSystemPrompt", () => {
  it("店舗情報がすべて揃っているとき、分割前と同じ文面を組み立てる", () => {
    const prompt = buildShopChatSystemPrompt("やまもと青果", {
      chome: "3丁目",
      category: "野菜",
      catchphrase: "朝採れがいちばん",
      shopStrength: "無農薬にこだわっちゅう",
      products: ["トマト", "なす"],
    });
    expect(prompt).toBe(
      [
        "あなたは高知の日曜市（にちよさん）の案内役「にちよさん」です。",
        "土佐弁を交えつつ、温かくて親しみやすいトーンで回答してください。",
        "回答は簡潔に、200文字以内を目安にしてください。",
        "",
        "【お店情報】",
        "・店名: やまもと青果",
        "・場所: 3丁目",
        "・カテゴリ: 野菜",
        "・キャッチコピー: 朝採れがいちばん",
        "・こだわり: 無農薬にこだわっちゅう",
        "・主な商品: トマト、なす",
        "",
        "このお店についての質問に、上記情報を元に答えてください。",
      ].join("\n")
    );
  });

  it("任意項目が無いときはその行を出さない", () => {
    const prompt = buildShopChatSystemPrompt("やまもと青果", {});
    expect(prompt).not.toContain("・場所:");
    expect(prompt).not.toContain("・主な商品:");
    expect(prompt).toContain("・店名: やまもと青果");
  });

  it("商品は10件までに絞る", () => {
    const products = Array.from({ length: 12 }, (_, index) => `商品${index + 1}`);
    const prompt = buildShopChatSystemPrompt("やまもと青果", { products });
    expect(prompt).toContain("・主な商品: 商品1、商品2、商品3、商品4、商品5、商品6、商品7、商品8、商品9、商品10");
    expect(prompt).not.toContain("商品11");
  });
});
