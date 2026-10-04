import { describe, expect, it } from "vitest";
import { parseShopEdit } from "./shopEdit";

const ok = (body: unknown) => {
  const result = parseShopEdit(body);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe("parseShopEdit", () => {
  it("送られた項目だけを返す（未指定の項目は触らない）", () => {
    const { vendor, ownerName } = ok({ shop_name: "  山田農園 ", payment_methods: ["cash", "cash", "paypay"] });
    expect(vendor).toEqual({ shop_name: "山田農園", payment_methods: ["cash", "paypay"] });
    expect(ownerName).toBeUndefined();
  });

  it("空文字は null（未入力）にそろえる。店主名も同じ", () => {
    const { vendor, ownerName } = ok({ style: "  ", sns_x: "", owner_name: "" });
    expect(vendor).toEqual({ style: null, sns_x: null });
    expect(ownerName).toBeNull();
  });

  it("商品は重複を除き、価格は0以上の整数かnull", () => {
    const { vendor } = ok({ main_products: ["大根", "大根", "ゆず"], main_product_prices: { 大根: 200, ゆず: null } });
    expect(vendor.main_products).toEqual(["大根", "ゆず"]);
    expect(vendor.main_product_prices).toEqual({ 大根: 200, ゆず: null });
    expect(parseShopEdit({ main_product_prices: { 大根: -1 } }).ok).toBe(false);
    expect(parseShopEdit({ main_product_prices: { 大根: 1.5 } }).ok).toBe(false);
    expect(parseShopEdit({ main_products: [""] }).ok).toBe(false);
  });

  it("営業時間は10分刻み・終了が開始より後", () => {
    expect(ok({ business_hours_start: "6:00", business_hours_end: "14:30" }).vendor).toEqual({
      business_hours_start: "6:00",
      business_hours_end: "14:30",
    });
    expect(parseShopEdit({ business_hours_start: "6:05" }).ok).toBe(false);
    expect(parseShopEdit({ business_hours_start: "9:00", business_hours_end: "8:00" }).ok).toBe(false);
    // 片方だけなら、ここでは前後を確かめない（ルートが保存済みの値と比べる）
    expect(ok({ business_hours_end: "8:00" }).vendor.business_hours_end).toBe("8:00");
  });

  it("掲載許可の記録を受け取る", () => {
    const { vendor } = ok({
      listing_status: "allowed",
      photo_use_allowed: true,
      listing_consented_on: "2026-10-11",
      listing_consent_note: "ご本人から口頭で許可",
    });
    expect(vendor).toEqual({
      listing_status: "allowed",
      photo_use_allowed: true,
      listing_consented_on: "2026-10-11",
      listing_consent_note: "ご本人から口頭で許可",
    });
  });

  it("写真の URL は vendor-images の公開 URL だけ", () => {
    const url = "https://x.supabase.co/storage/v1/object/public/vendor-images/a/store-main.webp";
    expect(ok({ shop_image_url: url }).vendor.shop_image_url).toBe(url);
    expect(ok({ shop_image_url: null }).vendor.shop_image_url).toBeNull();
  });

  it("不正な値は理由つきで断る", () => {
    for (const body of [
      null,
      [],
      {},
      { shop_name: "" },
      { category_id: "not-uuid" },
      { payment_methods: ["bitcoin"] },
      { rain_policy: "storm" },
      { sns_hp: "javascript:alert(1)" },
      { shop_image_url: "ftp://example.com/a.png" },
      { shop_image_url: "https://example.com/a.png" },
      { shop_image_url: "http://x.supabase.co/storage/v1/object/public/vendor-images/a/store-main.webp" },
      { listing_status: "yes" },
      { photo_use_allowed: "true" },
      { listing_consented_on: "2026/10/11" },
    ]) {
      expect(parseShopEdit(body).ok, JSON.stringify(body)).toBe(false);
    }
  });
});
