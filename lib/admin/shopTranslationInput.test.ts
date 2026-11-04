import { describe, expect, it } from "vitest";
import { parseShopTranslationInput, parseTranslationSourceInput } from "./shopTranslationInput";

describe("parseShopTranslationInput", () => {
  it("前後の空白を除き、空の項目は null / 除外にする", () => {
    const result = parseShopTranslationInput({ name: " Yamada ", strength: "", style: null, products: { 大根: " Radish ", 人参: "  " } });
    expect(result).toEqual({ ok: true, value: { name: "Yamada", strength: null, style: null, products: { 大根: "Radish" } } });
  });

  it("長すぎる項目・形が違う入力は弾く", () => {
    expect(parseShopTranslationInput({ name: "a".repeat(1281) }).ok).toBe(false);
    expect(parseShopTranslationInput({ products: { 大根: "a".repeat(321) } }).ok).toBe(false);
    expect(parseShopTranslationInput({ strength: "a".repeat(1280), products: { 大根: "a".repeat(320) } }).ok).toBe(true);
    expect(parseShopTranslationInput({ products: ["x"] }).ok).toBe(false);
    expect(parseShopTranslationInput({ products: { 大根: 1 } }).ok).toBe(false);
    expect(parseShopTranslationInput({ name: 1 }).ok).toBe(false);
    expect(parseShopTranslationInput(null).ok).toBe(false);
  });
});

describe("parseTranslationSourceInput", () => {
  it("商品は重複を除き並べ替える", () => {
    const result = parseTranslationSourceInput({ name: " 山田商店 ", products: ["b", "a", "b", " "] });
    expect(result).toEqual({ ok: true, value: { name: "山田商店", strength: "", style: "", products: ["a", "b"] } });
  });

  it("すべて空ならエラー", () => {
    expect(parseTranslationSourceInput({ name: " ", products: [] }).ok).toBe(false);
  });
});
