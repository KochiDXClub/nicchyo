import { describe, expect, it } from "vitest";
import type { Shop } from "../map/data/shops";
import { LANDING_SHOP_PHOTO_LIMIT, pickLandingShopPhotos, uploadedShopImage } from "./pickLandingShops";

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
