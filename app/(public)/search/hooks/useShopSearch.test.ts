import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Shop } from "../../map/data/shops";
import { buildSearchIndex } from "../lib/searchIndex";
import { useShopSearch } from "./useShopSearch";

function makeShop(id: number, name: string, category: string, products: string[]): Shop {
  return { id, name, category, products, ownerName: "", chome: null } as unknown as Shop;
}

const shops = [
  makeShop(1, "山田商店", "野菜", ["トマト", "なす"]),
  makeShop(2, "ヘンプ屋", "雑貨", ["CBD"]),
  makeShop(3, "果物屋", "フルーツ", ["みかん"]),
  makeShop(4, "Apple Stand", "drinks", ["juice"]),
];
const searchIndex = buildSearchIndex(shops);

function search(textQuery: string, category: string | null = null) {
  const { result } = renderHook(() =>
    useShopSearch({ shops, searchIndex, textQuery, category, chome: null })
  );
  return result.current.map((s) => s.id);
}

describe("useShopSearch のかな・全角半角の正規化", () => {
  it("ひらがな「とまと」でカタカナ「トマト」の店が見つかる", () => {
    expect(search("とまと")).toEqual([1]);
  });

  it("全角「ｃｂｄ」で半角「CBD」の店が見つかる", () => {
    expect(search("ｃｂｄ")).toEqual([2]);
  });

  it("カタカナのジャンルでも絞り込める", () => {
    expect(search("", "フルーツ")).toEqual([3]);
  });

  it("英字の大文字小文字は区別しない", () => {
    expect(search("APPLE")).toEqual([4]);
  });
});
