import { describe, expect, it } from "vitest";
import { applyShopDelta, buildVendorShops, pruneInvisibleVendors, type VendorShopBaseRows } from "./shopDb";

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
          { id: "p44", vendor_id: "v1", name: "トマト", image_url: IMAGE_URL },
          { id: "p45", vendor_id: "v1", name: "きゅうり", image_url: null },
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
      baseRows({ products: [{ id: "p58", vendor_id: "v1", name: "トマト", image_url: null }] }),
      []
    );

    expect(shop.productDetails).toBeUndefined();
  });

  it("他の店舗の商品の写真は混ぜない", () => {
    const [shop] = buildVendorShops(
      baseRows({ products: [{ id: "p9", vendor_id: "v2", name: "トマト", image_url: IMAGE_URL }] }),
      []
    );

    expect(shop.productDetails).toBeUndefined();
  });
});

describe("applyShopDelta", () => {
  const vendor = (id: string, shopName: string) => ({ ...baseRows().vendors[0], id, shop_name: shopName });
  const product = (id: string, name: string, imageUrl: string | null = null) => ({
    id,
    vendor_id: "v1",
    name,
    image_url: imageUrl,
  });
  const empty = { vendors: [], products: [], deletedProductIds: [], visibleVendorCount: 0 };

  it("差分が空なら、元のデータをそのまま返す", () => {
    const base = baseRows();
    expect(applyShopDelta(base, empty)).toBe(base);
  });

  it("変わった商品は id で置き換え、新しい商品は足す", () => {
    const base = baseRows({ products: [product("p1", "トマト"), product("p2", "きゅうり")] });
    const merged = applyShopDelta(base, { ...empty, products: [product("p1", "トマト", IMAGE_URL), product("p3", "なす")] });

    expect(merged.products).toEqual([product("p1", "トマト", IMAGE_URL), product("p2", "きゅうり"), product("p3", "なす")]);
    // 元のデータは書き換えない(キャッシュの中身を汚さない)
    expect(base.products[0].image_url).toBeNull();
  });

  it("消えた商品は外す。同じ差分に変更があっても、消した方を優先する", () => {
    const base = baseRows({ products: [product("p1", "トマト"), product("p2", "きゅうり")] });
    const merged = applyShopDelta(base, { ...empty, products: [product("p1", "トマト", IMAGE_URL)], deletedProductIds: ["p1"] });

    expect(merged.products).toEqual([product("p2", "きゅうり")]);
  });

  it("変わった店舗は id で置き換え、新しい店舗は足す", () => {
    const base = baseRows({ vendors: [vendor("v1", "山田農園")] });
    const merged = applyShopDelta(base, { ...empty, vendors: [vendor("v1", "山田農園本店"), vendor("v2", "佐藤商店")] });

    expect(merged.vendors.map((row) => [row.id, row.shop_name])).toEqual([
      ["v1", "山田農園本店"],
      ["v2", "佐藤商店"],
    ]);
  });

  it("同じ差分を二度重ねても結果は同じ(取得の余裕で重なっても害がない)", () => {
    const base = baseRows({ products: [product("p1", "トマト")] });
    const delta = { ...empty, products: [product("p1", "トマト", IMAGE_URL)], deletedProductIds: ["p9"] };

    expect(applyShopDelta(applyShopDelta(base, delta), delta)).toEqual(applyShopDelta(base, delta));
  });
});

describe("pruneInvisibleVendors", () => {
  const vendor = (id: string) => ({ ...baseRows().vendors[0], id });
  const product = (id: string, vendorId: string) => ({ id, vendor_id: vendorId, name: id, image_url: null });

  it("来訪者に見えなくなった店舗と、その商品を外す。元のデータは変えない", () => {
    const base = baseRows({
      vendors: [vendor("v1"), vendor("v2")],
      products: [product("p1", "v1"), product("p2", "v2")],
    });

    const pruned = pruneInvisibleVendors(base, new Set(["v1"]));

    expect(pruned.vendors.map((row) => row.id)).toEqual(["v1"]);
    expect(pruned.products.map((row) => row.id)).toEqual(["p1"]);
    expect(base.vendors).toHaveLength(2);
  });

  it("外す店舗が無ければ、元のデータをそのまま返す", () => {
    const base = baseRows({ vendors: [vendor("v1")] });
    expect(pruneInvisibleVendors(base, new Set(["v1", "v9"]))).toBe(base);
  });
});
