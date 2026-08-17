import { describe, it, expect } from "vitest";
import { maskPii } from "./maskPii";

describe("maskPii", () => {
  it("メールアドレスをマスクする", () => {
    expect(maskPii("連絡先は taro@example.com です")).toBe(
      "連絡先は [メールアドレス] です"
    );
  });

  it("ハイフン区切りの携帯番号をマスクする", () => {
    expect(maskPii("090-1234-5678に電話して")).toBe("[電話番号]に電話して");
  });

  it("ハイフンなしの固定電話番号をマスクする", () => {
    expect(maskPii("0881234567まで")).toBe("[電話番号]まで");
  });

  it("スペース区切りの番号をマスクする", () => {
    expect(maskPii("080 1234 5678")).toBe("[電話番号]");
  });

  it("メールと電話が両方あれば両方マスクする", () => {
    expect(maskPii("hana@example.jp / 090-0000-0000")).toBe(
      "[メールアドレス] / [電話番号]"
    );
  });

  it("金額や年号など桁数が合わない数字はマスクしない", () => {
    expect(maskPii("0800円のトマト")).toBe("0800円のトマト");
    expect(maskPii("創業は1970年")).toBe("創業は1970年");
  });

  it("店舗コードのような短い数字はマスクしない", () => {
    expect(maskPii("012番のお店はどこ？")).toBe("012番のお店はどこ？");
  });

  it("個人情報がなければ元の文字列を返す", () => {
    const text = "おすすめの野菜を教えて";
    expect(maskPii(text)).toBe(text);
  });

  it("空文字列はそのまま返す", () => {
    expect(maskPii("")).toBe("");
  });
});
