import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SHOP_CATEGORY_NAMES } from "../map/config/shopCategories";
import { GENRES } from "./content";

describe("GENRES（トップの何に興味ある？）", () => {
  it("店舗カテゴリを、過不足なくそのまま並べる（地図の ?category= に渡せる名前）", () => {
    expect(GENRES.map((genre) => genre.category)).toEqual([...SHOP_CATEGORY_NAMES]);
  });

  it("どのカテゴリのイラストも、public/ に実在する", () => {
    for (const genre of GENRES) {
      expect(existsSync(path.join(process.cwd(), "public", genre.art)), genre.art).toBe(true);
    }
  });
});
