"use client";

import { useState } from "react";
import { showToast } from "@/lib/admin/toast";
import { imageErrorMessage, resizeImageToBlob, STORE_IMAGE_CONFIG } from "@/lib/image/clientCompression";
import type { AdminShopDetail } from "@/lib/admin/shopEdit";

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    return ((await res.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * 現場登録の商品写真の保存・削除（/api/admin/shops/[id]/product-image）。
 * 保存済みの商品だけが対象。写真の状態は店舗（shop.product_images）に反映し、フォームの未保存の入力には触れない。
 */
export function useProductPhotos(
  shopId: string,
  setShop: (update: (prev: AdminShopDetail | null) => AdminShopDetail | null) => void,
) {
  /** 写真を保存中・外している最中の商品名 */
  const [productPhotoBusy, setProductPhotoBusy] = useState<string | null>(null);

  /** ブラウザで縮めて送り、サーバーが WebP にして保存する */
  const uploadProductPhoto = async (name: string, file: File) => {
    setProductPhotoBusy(name);
    try {
      const photo = await resizeImageToBlob(file, STORE_IMAGE_CONFIG.main);
      const body = new FormData();
      body.append("name", name);
      body.append("photo", photo, "photo");
      const res = await fetch(`/api/admin/shops/${shopId}/product-image`, { method: "POST", body });
      if (!res.ok) throw new Error(await readErrorMessage(res, "写真を保存できませんでした"));
      const { url } = (await res.json()) as { url: string };
      setShop((prev) => (prev ? { ...prev, product_images: { ...prev.product_images, [name]: url } } : prev));
      showToast.success("商品の写真を保存しました");
    } catch (e) {
      showToast.error(imageErrorMessage(e, e instanceof Error ? e.message : "写真を保存できませんでした"));
    } finally {
      setProductPhotoBusy(null);
    }
  };

  const removeProductPhoto = async (name: string) => {
    setProductPhotoBusy(name);
    try {
      const res = await fetch(`/api/admin/shops/${shopId}/product-image`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await readErrorMessage(res, "写真を外せませんでした"));
      setShop((prev) => {
        if (!prev) return prev;
        const { [name]: _removed, ...rest } = prev.product_images ?? {};
        return { ...prev, product_images: rest };
      });
      showToast.success("商品の写真を外しました");
    } catch (e) {
      showToast.error(e instanceof Error ? e.message : "写真を外せませんでした");
    } finally {
      setProductPhotoBusy(null);
    }
  };

  return { productPhotoBusy, uploadProductPhoto, removeProductPhoto };
}
