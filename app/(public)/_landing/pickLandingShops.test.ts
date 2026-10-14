import { describe, expect, it } from "vitest";
import type { Shop } from "../map/data/shops";
import { LANDING_SHOP_PHOTO_LIMIT, pickLandingShops, uploadedShopImage } from "./pickLandingShops";

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

describe("pickLandingShops", () => {
  it("写真のある店が無ければ、紹介する店も写真の帯も空", () => {
    expect(pickLandingShops([shop({ id: 1 }), shop({ id: 2 })])).toEqual({ showcase: null, photos: [] });
  });

  it("紹介する店は、商品・一言がそろった店を優先し、写真の帯とは重ねない", () => {
    const plain = shop({ id: 1, images: { main: SUPABASE_IMAGE } });
    const complete = shop({
      id: 5,
      images: { main: SUPABASE_IMAGE },
      products: ["芋天"],
      catchphrase: "揚げたて",
    });
    const { showcase, photos } = pickLandingShops([complete, plain]);
    expect(showcase?.id).toBe(5);
    expect(photos.map((p) => p.id)).toEqual([1]);
    expect(photos[0]).toMatchObject({ code: "001", name: "店1", image: SUPABASE_IMAGE });
  });

  it("写真の帯は id 順で、上限までに切る", () => {
    const shops = Array.from({ length: 12 }, (_, i) => shop({ id: 12 - i, images: { main: SUPABASE_IMAGE } }));
    const { photos } = pickLandingShops(shops);
    expect(photos).toHaveLength(LANDING_SHOP_PHOTO_LIMIT);
    expect(photos.map((p) => p.id)).toEqual([...photos.map((p) => p.id)].sort((a, b) => a - b));
  });
});
