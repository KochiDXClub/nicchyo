"use client";
import { useCategorizedShop } from "@/lib/categories/CategoryContext";

import { shopCategoryLabel } from "@/lib/i18n/shopTranslation";
import Image from "next/image";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { useT } from "@/lib/i18n/LocaleContext";
import { getShopPreviewImage } from "@/lib/shopImages";
import type { ShopCategory } from "../../map/config/shopCategories";
import type { Shop } from "../../map/data/shops";

/**
 * にちよさんが紹介してくれたお店のカード。
 *
 * 現地では「どんな店か」を文字で読ませても伝わらない。写真が出ているかどうかで
 * 寄ってみるかどうかが決まるので、写真をカードの主役に置く。
 *
 * 画像は3段構え：
 *   1. 出店者が登録したメイン画像
 *   2. カテゴリ別の既定画像（lib/shopImages.ts）
 *   3. 読み込みに失敗したらカテゴリの絵文字とグラデーション
 * 屋外の細い回線でも「画像が割れたカード」を見せないための保険。
 */

/**
 * 画像が出せなかったときの代替。キーは config/shopCategories.ts の正の名前に合わせる。
 * （ShopBannerHero の CATEGORY_FALLBACK は旧カテゴリ名のままなので使わない）
 */
const CATEGORY_FALLBACK: Record<ShopCategory, { emoji: string; gradient: string }> = {
  "食材": { emoji: "🥦", gradient: "bg-gradient-to-br from-emerald-100 to-green-200" },
  "食べ物": { emoji: "🍡", gradient: "bg-gradient-to-br from-orange-100 to-amber-200" },
  "道具・工具": { emoji: "🔧", gradient: "bg-gradient-to-br from-slate-100 to-zinc-200" },
  "生活雑貨": { emoji: "🧺", gradient: "bg-gradient-to-br from-amber-100 to-yellow-200" },
  "植物・苗": { emoji: "🌱", gradient: "bg-gradient-to-br from-lime-100 to-emerald-200" },
  "アクセサリー": { emoji: "💍", gradient: "bg-gradient-to-br from-rose-100 to-pink-200" },
  "手作り・工芸": { emoji: "🎨", gradient: "bg-gradient-to-br from-violet-100 to-indigo-200" },
};

const DEFAULT_FALLBACK = { emoji: "🏪", gradient: "bg-gradient-to-br from-amber-100 to-orange-200" };

export interface ConsultShopCardProps {
  shop: Shop;
  onSelect: (shopId: number, shop: Shop) => void;
  /** 1件だけのときは横幅いっぱいに広げ、説明を表示する */
  single?: boolean;
}

export default function ConsultShopCard({
  shop: sourceShop,
  onSelect,
  single = false,
}: ConsultShopCardProps) {
  const shop = useCategorizedShop(sourceShop);
  const t = useT();
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = getShopPreviewImage(shop);
  const fallback = CATEGORY_FALLBACK[(shop.categoryKey ?? shop.category) as ShopCategory] ?? DEFAULT_FALLBACK;
  const products = (shop.products ?? []).filter(Boolean).slice(0, 3);

  return (
    <button
      type="button"
      onClick={() => onSelect(shop.id, shop)}
      className={`group flex min-w-0 overflow-hidden rounded-card border border-line bg-white text-left transition hover:border-amber-400 focus-visible:ring-2 focus-visible:ring-amber-600 ${single ? "sm:col-span-2" : ""}`}
    >
      {/* 写真。カードの主役 */}
      <div className="relative w-24 shrink-0 overflow-hidden sm:w-28">
        {imageFailed ? (
          <div
            className={`flex h-full w-full items-center justify-center ${fallback.gradient}`}
            aria-hidden="true"
          >
            <span className={single ? "text-5xl" : "text-4xl"}>{fallback.emoji}</span>
          </div>
        ) : (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes="(min-width: 640px) 112px, 96px"
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        )}

        {shop.category && (
          <span className="absolute bottom-1 left-1 max-w-full rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {shopCategoryLabel(shop)}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3">
        <p
          className={`font-bold leading-snug break-words text-nicchyo-ink ${
            single ? "text-lg" : "line-clamp-2 text-sm"
          }`}
        >
          {shop.name}
        </p>

        {shop.chome && (
          <p className="flex items-center gap-1 text-xs text-nicchyo-ink/70">
            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {shop.chome}
          </p>
        )}

        {products.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {products.map((product) => (
              <span
                key={product}
                className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-800"
              >
                {product}
              </span>
            ))}
          </div>
        )}

        {single && shop.description && (
          <p className="line-clamp-2 text-xs leading-5 text-nicchyo-ink/75">{shop.description}</p>
        )}

        <span className="mt-auto pt-1 text-[11px] font-bold text-amber-700">{t("くわしく見る →")}</span>
      </div>
    </button>
  );
}
