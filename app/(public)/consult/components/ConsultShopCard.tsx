"use client";

import Image from "next/image";
import { useState } from "react";
import { MapPin } from "lucide-react";
import { getShopBannerImage } from "@/lib/shopImages";
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
  /** 1件だけのときは横幅いっぱいに広げ、写真を大きく見せる */
  variant?: "single" | "carousel";
}

export default function ConsultShopCard({
  shop,
  onSelect,
  variant = "carousel",
}: ConsultShopCardProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const imageUrl = shop.images?.main ?? getShopBannerImage(shop.category, shop.id);
  const fallback = CATEGORY_FALLBACK[shop.category as ShopCategory] ?? DEFAULT_FALLBACK;
  const products = (shop.products ?? []).filter(Boolean).slice(0, 3);
  const isSingle = variant === "single";

  return (
    <button
      type="button"
      onClick={() => onSelect(shop.id, shop)}
      className={`group flex shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-amber-100 bg-white text-left shadow-sm transition active:scale-[0.98] ${
        isSingle ? "w-full" : "w-[240px]"
      }`}
    >
      {/* 写真。カードの主役 */}
      <div className={`relative w-full overflow-hidden ${isSingle ? "h-40" : "h-28"}`}>
        {imageFailed ? (
          <div
            className={`flex h-full w-full items-center justify-center ${fallback.gradient}`}
            aria-hidden="true"
          >
            <span className={isSingle ? "text-5xl" : "text-4xl"}>{fallback.emoji}</span>
          </div>
        ) : (
          <Image
            src={imageUrl}
            alt=""
            fill
            sizes={isSingle ? "(max-width: 768px) 100vw, 640px" : "240px"}
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        )}

        {shop.category && (
          <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-sm">
            {shop.category}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p
          className={`font-bold leading-snug text-slate-900 ${
            isSingle ? "text-lg" : "line-clamp-2 text-sm"
          }`}
        >
          {shop.name}
        </p>

        {shop.chome && (
          <p className="flex items-center gap-1 text-xs text-slate-500">
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

        {isSingle && shop.description && (
          <p className="line-clamp-2 text-xs leading-5 text-slate-600">{shop.description}</p>
        )}

        <span className="mt-auto pt-1 text-[11px] font-bold text-amber-700">くわしく見る →</span>
      </div>
    </button>
  );
}
