"use client";

import Image from "next/image";
import { Heart } from "lucide-react";
import type { Shop } from "../data/shops";

export function formatProductPrice(price: number | null | undefined) {
  return price != null ? `¥${price.toLocaleString()}` : "価格は現地で確認";
}

function ProductFavoriteButton({
  product,
  isFavorite,
  onToggle,
  className,
}: {
  product: string;
  isFavorite: boolean;
  onToggle: () => void;
  className: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `${product}をお気に入りから外す` : `${product}をお気に入りに入れる`}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 motion-reduce:active:scale-100 ${
        isFavorite ? "bg-favorite-fg text-white" : "text-favorite-fg"
      } ${className}`}
    >
      <Heart className="h-[18px] w-[18px]" fill={isFavorite ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

/**
 * 店の商品。写真のある商品は大きな写真のカードで先に並べ（タップで拡大）、
 * 写真の無い商品はその下に名前と値段の一覧で続ける。
 *
 * 来訪者は写真を見て選ぶので、写真を主役にする。写真の無い商品まで同じ大きさの枠にすると、
 * 空の枠ばかりが目立つので分けている。
 */
export function ShopProductGrid({
  shop,
  imageOf,
  isProductFavorite,
  onToggleProduct,
  onOpenPhoto,
}: {
  shop: Shop;
  /** その商品の写真の URL。無ければ undefined */
  imageOf: (product: string) => string | undefined;
  isProductFavorite: (product: string) => boolean;
  onToggleProduct: (product: string) => void;
  onOpenPhoto: (src: string) => void;
}) {
  const withPhoto = shop.products.filter((product) => !!imageOf(product));
  const withoutPhoto = shop.products.filter((product) => !imageOf(product));

  if (shop.products.length === 0) {
    return (
      <p className="rounded-card bg-white px-4 py-4 text-sm text-nicchyo-ink/55 ring-1 ring-line">
        商品情報は準備中です
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {withPhoto.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {withPhoto.map((product) => {
            const src = imageOf(product)!;
            const favorite = isProductFavorite(product);
            return (
              <li key={product} className="overflow-hidden rounded-card bg-white shadow-card ring-1 ring-line">
                <div className="relative aspect-square bg-nicchyo-ink/[0.04]">
                  <button
                    type="button"
                    onClick={() => onOpenPhoto(src)}
                    aria-label={`${product}の写真を大きく見る`}
                    className="absolute inset-0"
                  >
                    <Image
                      src={src}
                      alt={`${product}の写真`}
                      fill
                      sizes="(max-width: 768px) 50vw, 260px"
                      className="object-cover"
                    />
                  </button>
                  <ProductFavoriteButton
                    product={product}
                    isFavorite={favorite}
                    onToggle={() => onToggleProduct(product)}
                    className={`absolute right-2 top-2 shadow-chip ${favorite ? "" : "bg-white/90 backdrop-blur-sm"}`}
                  />
                </div>
                <div className="px-3 py-2.5">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-nicchyo-ink">{product}</p>
                  <p className="mt-0.5 text-xs text-nicchyo-ink/55">{formatProductPrice(shop.productPrices?.[product])}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {withoutPhoto.length > 0 && (
        <ul className="divide-y divide-line overflow-hidden rounded-card bg-white ring-1 ring-line">
          {withoutPhoto.map((product) => {
            const favorite = isProductFavorite(product);
            return (
              <li key={product} className="flex items-center gap-3 py-2 pl-4 pr-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-nicchyo-ink">{product}</p>
                  <p className="mt-0.5 text-xs text-nicchyo-ink/55">{formatProductPrice(shop.productPrices?.[product])}</p>
                </div>
                <ProductFavoriteButton
                  product={product}
                  isFavorite={favorite}
                  onToggle={() => onToggleProduct(product)}
                  className={favorite ? "" : "hover:bg-favorite-bg"}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
