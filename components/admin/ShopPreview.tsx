"use client";
import { useEffect, useState } from "react";
import type { AdminShopDetail } from "@/lib/admin/shopEdit";
import { isSupabaseStorageUrl } from "@/lib/admin/productImages";
import { getShopPreviewImage } from "@/lib/shopImages";
import { ShopBannerHero, ShopInfoList, resolveBannerTheme } from "@/app/(public)/map/components/ShopBannerHero";
import type { Shop } from "@/app/(public)/map/types/shopData";

function isProjectStorageUrl(value: string): boolean {
  if (!isSupabaseStorageUrl(value) || !process.env.NEXT_PUBLIC_SUPABASE_URL) return false;
  try { return new URL(value).origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin; }
  catch { return false; }
}

/** 公開マップと同じバナー部品を、管理者用に閲覧する。閲覧数やお気に入りは変更しない。 */
export function ShopPreview({ vendorId, position, onClose }: { vendorId: string; position: number; onClose: () => void }) {
  const [detail, setDetail] = useState<AdminShopDetail | null>(null);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState(false);
  useEffect(() => {
    let active = true;
    setDetail(null); setError(""); setImageError(false);
    void fetch(`/api/admin/shops/${encodeURIComponent(vendorId)}`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("店舗情報を取得できませんでした");
      const body = await response.json() as { shop: AdminShopDetail };
      if (active) setDetail(body.shop);
    }).catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "店舗情報を取得できませんでした"); });
    return () => { active = false; };
  }, [vendorId]);
  const image = detail?.photo_use_allowed && detail.shop_image_url && isProjectStorageUrl(detail.shop_image_url) ? detail.shop_image_url : undefined;
  const shop: Shop | null = detail ? {
    id: position, position, lat: 0, lng: 0, vendorId, name: detail.shop_name,
    ownerName: detail.owner_name ?? "", category: detail.category_name ?? "", categoryId: detail.category_id ?? undefined,
    products: detail.main_products ?? [], productPrices: detail.main_product_prices ?? undefined,
    description: "", schedule: "", shopStrength: detail.strength ?? undefined,
    paymentMethods: detail.payment_methods ?? [], rainPolicy: detail.rain_policy ?? undefined,
    businessHoursStart: detail.business_hours_start ?? undefined, businessHoursEnd: detail.business_hours_end ?? undefined,
    ...(image ? { images: { main: image, mainKind: detail.shop_image_kind ?? "normal" } } : {}),
  } : null;
  return <div className="my-3 overflow-hidden rounded-lg border border-nicchyo-ink/15 bg-white" aria-label="店舗バナーのプレビュー">
    <div className="flex items-center justify-between gap-2 p-3"><strong className="text-sm">店舗バナー</strong><button type="button" className="text-sm underline" onClick={onClose}>閉じる</button></div>
    {error ? <p role="alert" className="p-3 text-sm">{error}</p> : shop ? <><ShopBannerHero shop={shop} bannerImage={getShopPreviewImage(shop)} theme={resolveBannerTheme()} heroImageError={imageError} onImageError={() => setImageError(true)} mode="expanded" /><div className="p-3"><ShopInfoList shop={shop} /></div></> : <p className="p-3 text-sm">読み込み中…</p>}
  </div>;
}
