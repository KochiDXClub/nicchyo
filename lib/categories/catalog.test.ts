import { describe, expect, it } from "vitest";
import { categoryKey, resolveCategory, withCategory } from "./catalog";
import { getShopCategoryColor } from "./presentation";
import { getShopPreviewImage } from "@/lib/shopImages";
const renamed = { id: "c1", name: "野菜・果物", presentation_key: "食材" };
describe("カテゴリの改名", () => {
  it("未選択を独自カテゴリに一致させない", () => {
    const categories = [{ id: "custom", name: "独自", presentation_key: null }];
    for (const value of [null, undefined, ""]) expect(resolveCategory(value, categories)).toBeUndefined();
  });
  it("古い店舗スナップショットもIDで最新名へ更新し、色と画像を維持する", () => {
    const old = { id: 1, categoryId: "c1", category: "食材" };
    const current = withCategory(old, [renamed]);
    expect(current.category).toBe("野菜・果物");
    expect(current.categoryKey).toBe("食材");
    expect(getShopCategoryColor(current.categoryKey)).toBe(getShopCategoryColor(old.category));
    expect(getShopPreviewImage(current)).toBe(getShopPreviewImage(old));
  });
  it("古い既定名のURLと新しいIDのURLは同じカテゴリを指す", () => {
    expect(resolveCategory("食材", [renamed])?.id).toBe("c1");
    expect(resolveCategory("c1", [renamed])?.name).toBe("野菜・果物");
  });
  it("新規カテゴリを固定リストで拒否しない", () => {
    const custom = { id: "c2", name: "お茶" };
    expect(resolveCategory("c2", [custom])).toBe(custom);
    expect(categoryKey(custom)).toBe("お茶");
  });
  it("IDを維持した再改名でも現在の名前を使い、正常時は店舗参照を維持する", () => {
    const shop = withCategory({ category: "食材", categoryId: "c1" }, [renamed]);
    expect(withCategory(shop, [renamed])).toBe(shop);
    expect(withCategory(shop, [{ ...renamed, name: "青果" }]).category).toBe("青果");
  });
});

it("表示名や旧キーと衝突してもカテゴリIDを優先する", () => {
  const categories = [{ id: "other", name: "c1" }, renamed];
  expect(resolveCategory("c1", categories)).toBe(renamed);
});
