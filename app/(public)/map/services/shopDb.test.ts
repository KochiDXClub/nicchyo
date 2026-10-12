import { describe, expect, it } from "vitest";
import { buildVendorShops, type VendorShopBaseRows } from "./shopDb";

const IMAGE_URL =
  "https://example.supabase.co/storage/v1/object/public/vendor-images/v1/product-p1.webp?v=1";

function baseRows(overrides: Partial<VendorShopBaseRows> = {}): VendorShopBaseRows {
  return {
    vendors: [
      {
        id: "v1",
        shop_name: "山田農園",
        strength: null,
        style: null,
        style_tags: null,
        category_id: null,
        categories: null,
        main_products: ["トマト", "きゅうり"],
        main_product_prices: { トマト: 300, きゅうり: null },
        payment_methods: null,
        rain_policy: null,
        schedule: null,
        shop_image_url: null,
        sns_instagram: null,
        sns_x: null,
        sns_hp: null,
        business_hours_start: null,
        business_hours_end: null,
      },
    ],
    ownerProfiles: [],
    categories: [],
    products: [],
    locations: [{ id: "l1", store_number: 12, latitude: 33.56, longitude: 133.53, district: "三丁目" }],
    assignments: [{ vendor_id: "v1", location_id: "l1", market_date: "2026-10-11" }],
    ...overrides,
  };
}

describe("buildVendorShops", () => {
  it("products テーブルの商品の写真を、商品名と組にしてバナーへ渡す", () => {
    const [shop] = buildVendorShops(
      baseRows({
        products: [
          { vendor_id: "v1", name: "トマト", image_url: IMAGE_URL },
          { vendor_id: "v1", name: "きゅうり", image_url: null },
        ],
      }),
      []
    );

    expect(shop.products).toEqual(["トマト", "きゅうり"]);
    // 写真の無い商品は持たせない（バナーは「画像」の枠を出す）
    expect(shop.productDetails).toEqual([{ name: "トマト", imageUrl: IMAGE_URL }]);
  });

  it("写真のある商品が1つも無ければ productDetails を持たせない", () => {
    const [shop] = buildVendorShops(
      baseRows({ products: [{ vendor_id: "v1", name: "トマト", image_url: null }] }),
      []
    );

    expect(shop.productDetails).toBeUndefined();
  });

  it("他の店舗の商品の写真は混ぜない", () => {
    const [shop] = buildVendorShops(
      baseRows({ products: [{ vendor_id: "v2", name: "トマト", image_url: IMAGE_URL }] }),
      []
    );

    expect(shop.productDetails).toBeUndefined();
  });
});
