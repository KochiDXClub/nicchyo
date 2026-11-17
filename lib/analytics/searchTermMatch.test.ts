import { describe, expect, it } from "vitest";
import { buildSearchTermDictionary, matchSearchTerm } from "./searchTermMatch";

const shops = [
  { name: "山田農園", category: "野菜", products: ["ミニトマト", "ぶんたん", "ＹＵＺＵ茶"], ownerName: "山田 太郎" },
  { name: "ひろめ屋", category: "食べ物", products: ["いも天"], ownerName: "鈴木花子" },
];
const dictionary = buildSearchTermDictionary(shops);

describe("buildSearchTermDictionary", () => {
  it("店舗名・カテゴリー・商品名を正規化して入れる", () => {
    expect(dictionary).toEqual(expect.arrayContaining(["山田農園", "野菜", "みにとまと", "ぶんたん", "yuzu茶", "ひろめ屋", "食べ物", "いも天"]));
  });

  it("店主名は入れない", () => {
    expect(dictionary.some((entry) => entry.includes("太郎") || entry.includes("花子") || entry.includes("鈴木"))).toBe(false);
  });
});

describe("matchSearchTerm", () => {
  it("商品名の一部でも一致する（正規化した語を返す）", () => {
    expect(matchSearchTerm("トマト", dictionary)).toBe("とまと");
    expect(matchSearchTerm("ぶんた", dictionary)).toBe("ぶんた");
  });

  it("全角・半角・カタカナ・大文字小文字の違いは同じ語として一致する", () => {
    expect(matchSearchTerm("ミニトマト", dictionary)).toBe("みにとまと");
    expect(matchSearchTerm("ﾐﾆﾄﾏﾄ", dictionary)).toBe("みにとまと");
    expect(matchSearchTerm("Ｙｕｚｕ", dictionary)).toBe("yuzu");
    expect(matchSearchTerm("YUZU", dictionary)).toBe("yuzu");
  });

  it("前後の空白は無視する", () => {
    expect(matchSearchTerm("  いも天 ", dictionary)).toBe("いも天");
  });

  it("店主名では一致しない（辞書に入れていない）", () => {
    expect(matchSearchTerm("太郎", dictionary)).toBeNull();
    expect(matchSearchTerm("山田 太郎", dictionary)).toBeNull();
    expect(matchSearchTerm("鈴木花子", dictionary)).toBeNull();
  });

  it("電話番号・氏名のような自由入力は null", () => {
    expect(matchSearchTerm("090-1234-5678", dictionary)).toBeNull();
    expect(matchSearchTerm("09012345678", dictionary)).toBeNull();
    expect(matchSearchTerm("佐藤健一", dictionary)).toBeNull();
    expect(matchSearchTerm("test@example.com", dictionary)).toBeNull();
  });

  it("2 文字未満は null（空白だけも）", () => {
    expect(matchSearchTerm("い", dictionary)).toBeNull();
    expect(matchSearchTerm(" 野 ", dictionary)).toBeNull();
    expect(matchSearchTerm("   ", dictionary)).toBeNull();
    expect(matchSearchTerm("", dictionary)).toBeNull();
  });

  it("長さは文字数（コードポイント）で見る: 絵文字 1 つは 1 文字なので null、上限 100 文字を超える語も null", () => {
    expect(matchSearchTerm("🍊", ["🍊みかん"])).toBeNull();
    expect(matchSearchTerm("🍊🍊", ["🍊🍊みかん"])).toBe("🍊🍊");
    const long = "あ".repeat(101);
    expect(matchSearchTerm(long, [long])).toBeNull();
    expect(matchSearchTerm("あ".repeat(100), [long])).toBe("あ".repeat(100));
  });

  it("辞書が空なら何も一致しない", () => {
    expect(matchSearchTerm("トマト", [])).toBeNull();
  });
});
