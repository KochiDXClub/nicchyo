import { describe, expect, test } from "vitest";
import type { Shop } from "@/app/(public)/map/types/shopData";
import {
  applyShopTranslation,
  buildTranslationSource,
  hasTranslatableText,
  limitSourceForTranslation,
  parseTranslationOutput,
  serializeTranslationSource,
  type TranslationBatchItem,
} from "./shopTranslation";

const baseShop = {
  id: 12,
  vendorId: "v-12",
  name: "中村商店",
  ownerName: "中村 太郎",
  category: "食べ物",
  products: ["芋天", "ぶんたん"],
  productPrices: { 芋天: 200, ぶんたん: null },
  productDetails: [{ name: "芋天", imageUrl: "https://example.com/a.webp" }],
  description: "",
  schedule: "",
  shopStrength: "揚げたてやき",
  stallStyle: "屋台",
  rainPolicy: "雨でも出ます",
} as unknown as Shop;

describe("buildTranslationSource", () => {
  test("店主の氏名を含めず、商品名は3か所の和集合を重複なく入れる", () => {
    const source = buildTranslationSource({
      ...baseShop,
      productDetails: [{ name: "土佐ジロー卵" }],
    } as Shop);
    expect(source.products).toEqual(["ぶんたん", "芋天", "土佐ジロー卵"].sort());
    expect(JSON.stringify(source)).not.toContain("中村 太郎");
  });

  test("原文がすべて空なら訳すものが無い", () => {
    const empty = buildTranslationSource({ ...baseShop, name: "", products: [], productPrices: undefined, productDetails: undefined, shopStrength: undefined, stallStyle: undefined, rainPolicy: undefined } as Shop);
    expect(hasTranslatableText(empty)).toBe(false);
    expect(hasTranslatableText(buildTranslationSource(baseShop))).toBe(true);
  });

  test("ロケールか原文が変わると別の文字列になる", () => {
    const source = buildTranslationSource(baseShop);
    expect(serializeTranslationSource("en", source)).toBe(serializeTranslationSource("en", { ...source }));
    expect(serializeTranslationSource("en", source)).not.toBe(
      serializeTranslationSource("en", { ...source, strength: "別の文" })
    );
  });
});

describe("parseTranslationOutput", () => {
  const items: TranslationBatchItem[] = [{ key: "v-12", source: buildTranslationSource(baseShop) }];

  test("要求した店の訳だけを読み、原文に無い商品名は捨てる", () => {
    const parsed = parseTranslationOutput(
      {
        items: [
          {
            key: "v-12",
            name: "Nakamura Shoten",
            strength: "Fresh from the fryer!",
            style: "Street stall",
            rainPolicy: "Open even when it rains",
            products: [
              { ja: "芋天", translated: "imoten (sweet potato tempura)" },
              { ja: "原文に無い商品", translated: "invented" },
            ],
          },
          { key: "v-999", name: "Unrequested", strength: "", style: "", rainPolicy: "", products: [] },
        ],
      },
      items
    );
    expect([...parsed.keys()]).toEqual(["v-12"]);
    expect(parsed.get("v-12")?.products).toEqual({ 芋天: "imoten (sweet potato tempura)" });
    expect(parsed.get("v-12")?.name).toBe("Nakamura Shoten");
  });

  test("原文が空の項目は、モデルが何を返しても訳として扱わない", () => {
    const source = buildTranslationSource({ ...baseShop, rainPolicy: undefined } as Shop);
    const parsed = parseTranslationOutput(
      { items: [{ key: "v-12", name: "N", strength: "s", style: "t", rainPolicy: "made up", products: [] }] },
      [{ key: "v-12", source }]
    );
    expect(parsed.get("v-12")?.rainPolicy).toBeNull();
  });

  test("形が違う返事は空になる", () => {
    expect(parseTranslationOutput(null, items).size).toBe(0);
    expect(parseTranslationOutput({ items: "x" }, items).size).toBe(0);
  });
});

describe("applyShopTranslation", () => {
  test("店名は「読み (日本語)」、商品名は3か所を同じ対応で置き換える", () => {
    const translated = applyShopTranslation(baseShop, {
      name: "Nakamura Shoten",
      strength: "Fresh from the fryer!",
      style: null,
      rainPolicy: null,
      products: { 芋天: "imoten" },
    });
    expect(translated.name).toBe("Nakamura Shoten (中村商店)");
    expect(translated.shopStrength).toBe("Fresh from the fryer!");
    expect(translated.stallStyle).toBe("屋台");
    expect(translated.products).toEqual(["imoten", "ぶんたん"]);
    expect(translated.productPrices).toEqual({ imoten: 200, ぶんたん: null });
    expect(translated.productDetails?.[0].name).toBe("imoten");
    // 位置・ID・カテゴリは言語によらず同じ
    expect(translated.id).toBe(12);
    expect(translated.vendorId).toBe("v-12");
  });

  test("訳が無ければ元のまま返す", () => {
    expect(applyShopTranslation(baseShop, undefined)).toBe(baseShop);
  });

  it("原文に対して極端に長い出力は捨てる（他店の文面への引きずられ対策）", () => {
    const items: TranslationBatchItem[] = [{ key: "1", source: buildTranslationSource(baseShop) }];
    const parsed = parseTranslationOutput(
      { items: [{ key: "1", name: "N", strength: "x".repeat(2000), style: "", rainPolicy: "", products: [] }] },
      items
    );
    expect(parsed.get("1")?.strength).toBeNull();
  });
});

describe("limitSourceForTranslation", () => {
  test("上限を超える項目は切り詰めず空にする（後半が消えた訳で全文を置き換えない）", () => {
    const long = "あ".repeat(301);
    const source = buildTranslationSource({ ...baseShop, shopStrength: long } as Shop);
    expect(source.strength).toBe(long);
    const limited = limitSourceForTranslation(source);
    expect(limited.strength).toBe("");
    expect(limited.rainPolicy).toBe("雨でも出ます");
  });

  test("ハッシュの元は全文なので、301文字目以降を直すと訳し直しの対象になる", () => {
    const a = buildTranslationSource({ ...baseShop, shopStrength: "あ".repeat(300) + "い" } as Shop);
    const b = buildTranslationSource({ ...baseShop, shopStrength: "あ".repeat(300) + "う" } as Shop);
    expect(serializeTranslationSource("en", a)).not.toBe(serializeTranslationSource("en", b));
  });
});

describe("applyShopTranslation の productOriginalNames", () => {
  test("訳した商品名から日本語の原文に引き戻せる（お気に入りのキー用）", () => {
    const translated = applyShopTranslation(baseShop, {
      name: "Nakamura Shoten",
      strength: null,
      style: null,
      rainPolicy: null,
      products: { 芋天: "imoten (sweet potato tempura)" },
    });
    expect(translated.productOriginalNames).toEqual({ "imoten (sweet potato tempura)": "芋天" });
  });
});
