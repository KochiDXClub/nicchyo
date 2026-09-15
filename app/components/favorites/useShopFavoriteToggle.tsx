"use client";

/**
 * 店のハートの押し下げを1か所にまとめる。
 *
 * 店のハートを外すと、その店にぶら下げた商品も一緒に消える。この後始末を
 * 画面ごとに書いていたため、確認を出す画面（店舗バナー・お気に入り一覧）と、
 * 何も聞かずに商品ごと消してしまう画面（検索・AI相談）が混在していた。
 * 店のハートはすべてこのフックを通す。
 *
 * 使い方:
 *   const { toggleShopFavorite, confirmDialog } = useShopFavoriteToggle();
 *   <button onClick={() => toggleShopFavorite(shop.id)} />
 *   {confirmDialog}
 */

import { useCallback, useState } from "react";
import { useReducedMotion } from "framer-motion";
import {
  getFavoriteProductsForShop,
  isShopFavorited,
  loadFavoriteEntries,
  removeFavoriteShop,
  toggleFavoriteShop,
  type FavoriteEntry,
} from "@/lib/favoriteShops";
import RemoveShopFavoriteDialog from "./RemoveShopFavoriteDialog";

type Options = {
  /** 重ねる相手に合わせて確認ダイアログの前後関係を変える */
  zIndexClassName?: string;
  /** 保存後の結果を受け取りたい画面向け（トーストなど） */
  onChange?: (entries: FavoriteEntry[]) => void;
};

export function useShopFavoriteToggle({ zIndexClassName, onChange }: Options = {}) {
  const prefersReducedMotion = useReducedMotion();
  // 確認待ちの店。商品がぶら下がっているときだけ立つ
  const [pending, setPending] = useState<{ shopId: number; productCount: number } | null>(null);

  const toggleShopFavorite = useCallback(
    (shopId: number) => {
      const entries = loadFavoriteEntries();
      if (isShopFavorited(entries, shopId)) {
        const products = getFavoriteProductsForShop(entries, shopId);
        if (products.length > 0) {
          setPending({ shopId, productCount: products.length });
          return;
        }
      }
      onChange?.(toggleFavoriteShop(shopId));
    },
    [onChange],
  );

  const handleConfirm = useCallback(() => {
    if (!pending) return;
    onChange?.(removeFavoriteShop(pending.shopId));
    setPending(null);
  }, [pending, onChange]);

  const confirmDialog = (
    <RemoveShopFavoriteDialog
      productCount={pending?.productCount ?? 0}
      open={!!pending}
      onCancel={() => setPending(null)}
      onConfirm={handleConfirm}
      reduceMotion={!!prefersReducedMotion}
      zIndexClassName={zIndexClassName}
    />
  );

  return { toggleShopFavorite, confirmDialog };
}
