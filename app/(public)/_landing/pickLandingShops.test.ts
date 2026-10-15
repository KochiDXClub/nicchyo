import { describe, expect, it } from "vitest";
import type { Shop } from "../map/data/shops";
import { LANDING_SHOP_PHOTO_LIMIT, pickGenrePhotos, pickLandingHeroShops, pickLandingShopPhotos, uploadedShopImage } from "./pickLandingShops";

const SUPABASE_IMAGE = "https://abc.supabase.co/storage/v1/object/public/shops/1.webp";

function shop(overrides: Partial<Shop> & { id: number }): Shop {
  return { name: `店${overrides.id}`, products: [], category: "食材", ...overrides } as Shop;
}

describe("uploadedShopImage", () => {
  it("出店者が登録した写真（main → thumbnail → additional）を拾う", () => {
    expect(uploadedShopImage(shop({ id: 1, images: { main: SUPABASE_IMAGE } }))).toBe(SUPABASE_IMAGE);
    expect(uploadedShopImage(shop({ id: 1, images: { additional: ["", SUPABASE_IMAGE] } }))).toBe(SUPABASE_IMAGE);
  });

  it("写真が無い店・next/image で配れない場所の写真は使わない", () => {
    expect(uploadedShopImage(shop({ id: 1 }))).toBeNull();
    expect(uploadedShopImage(shop({ id: 1, images: { main: "https://example.com/a.jpg" } }))).toBeNull();
    expect(uploadedShopImage(shop({ id: 1, images: { main: "not a url" } }))).toBeNull();
  });
});

describe("pickLandingShopPhotos", () => {
  it("写真のある店だけを、店番つきで並べる", () => {
    const photos = pickLandingShopPhotos([shop({ id: 2 }), shop({ id: 1, images: { main: SUPABASE_IMAGE } })]);
    expect(photos).toEqual([{ id: 1, code: "001", name: "店1", image: SUPABASE_IMAGE }]);
  });

  it("id 順で、上限までに切る", () => {
    const shops = Array.from({ length: 12 }, (_, i) => shop({ id: 12 - i, images: { main: SUPABASE_IMAGE } }));
    const photos = pickLandingShopPhotos(shops);
    expect(photos).toHaveLength(LANDING_SHOP_PHOTO_LIMIT);
    expect(photos.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("pickGenrePhotos", () => {
  it("カテゴリごとに、写真のある店のうち id が最小の1店を選ぶ。写真の無いカテゴリは含めない", () => {
    const shops = [
      shop({ id: 5, category: "食材", images: { main: SUPABASE_IMAGE } }),
      shop({ id: 2, category: "食材" }),
      shop({ id: 3, category: "食べ物", images: { main: SUPABASE_IMAGE } }),
      shop({ id: 9, category: "食材", images: { main: SUPABASE_IMAGE.replace("1.webp", "9.webp") } }),
      shop({ id: 7, category: "道具・工具" }),
    ];
    const result = pickGenrePhotos(shops, ["食材", "食べ物", "道具・工具"]);
    expect(result["食材"]?.name).toBe("店5");
    expect(result["食べ物"]?.name).toBe("店3");
    expect(result["道具・工具"]).toBeUndefined();
  });
});

describe("pickLandingHeroShops", () => {
  it("写真のある店を優先し、足りなければ写真の無い店で補う", () => {
    const shops = [
      shop({ id: 1, category: "食材" }),
      shop({ id: 2, category: "食べ物", images: { main: SUPABASE_IMAGE } }),
      shop({ id: 3, category: "道具・工具" }),
    ];
    const ids = pickLandingHeroShops(shops, 3).map((s) => s.id);
    expect(ids[0]).toBe(2);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });
});
