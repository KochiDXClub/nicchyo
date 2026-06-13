"use client";

import Link from "next/link";
import Image from "next/image";
import { memo } from "react";
import type { MouseEvent } from "react";
import type { Shop } from "../../map/data/shops";
import { saveSearchMapPayload } from "../../../../lib/searchMapStorage";
import { getShopBannerImage } from "../../../../lib/shopImages";

interface ShopResultCardProps {
  shop: Shop;
  isFavorite: boolean;
  onToggleFavorite?: (shopId: number) => void;
  onSelectShop?: (shop: Shop) => void;
  compact?: boolean;
  enableSearchMapHighlight?: boolean;
  mapLabel?: string;
}

/**
 * 店舗検索結果カードコンポーネント
 * 店舗情報と「地図で見る」リンクを表示
 */
function ShopResultCard({
  shop,
  isFavorite,
  onToggleFavorite,
  onSelectShop,
  compact = false,
  enableSearchMapHighlight = false,
  mapLabel: mapLabelProp,
}: ShopResultCardProps) {
  const previewImage =
    shop.images?.main ||
    shop.images?.thumbnail ||
    shop.images?.additional?.[0] ||
    getShopBannerImage(shop.category, shop.position ?? shop.id);
  const mapLabel = mapLabelProp ?? shop.name;
  const mapHref = enableSearchMapHighlight
    ? `/map?search=1&label=${encodeURIComponent(mapLabel)}&shop=${shop.id}`
    : `/map?shop=${shop.id}`;

  const handleOpenMap = (event: MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    if (enableSearchMapHighlight) {
      saveSearchMapPayload({ ids: [shop.id], label: mapLabel });
    }
  };

  return (
    <div
      className={`cursor-pointer rounded-xl border-2 border-orange-300 bg-amber-50/40 shadow-sm transition hover:bg-orange-50 active:scale-[1.02] active:bg-orange-50 ${
        compact ? "px-3 py-1.5 w-64 shrink-0" : "px-3.5 py-2"
      }`}
      role="button"
      tabIndex={0}
      onClick={() => onSelectShop?.(shop)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectShop?.(shop);
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div>
            <h3 className={`${compact ? "text-sm" : "text-base"} font-semibold text-gray-900`}>
              {shop.name}
            </h3>
            <p className={`${compact ? "text-[10px]" : "text-xs"} text-gray-600`}>
              {shop.ownerName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleFavorite?.(shop.id)}
            onMouseDown={(event) => event.stopPropagation()}
            onClickCapture={(event) => event.stopPropagation()}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? "Remove favorite" : "Add favorite"}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold shadow-sm transition ${
              isFavorite
                ? "border-pink-300 bg-pink-500 text-white"
                : "border-pink-200 bg-white text-pink-500 hover:bg-pink-50"
            }`}
          >
            {"\u2665"}
          </button>
          <span
            className={`rounded-full bg-amber-600 px-2 py-1 font-semibold text-white ${
              compact ? "text-[10px]" : "text-xs"
            }`}
          >
            #{shop.id}
          </span>
        </div>
      </div>

      <div className={`${compact ? "mt-1.5" : "mt-2"} flex gap-3 overflow-hidden rounded-xl border border-amber-100 bg-white p-2.5`}>
        <Image
          src={previewImage}
          alt={`${shop.name}の画像`}
          width={128}
          height={96}
          className={`${compact ? "h-20 w-20" : "h-24 w-28 sm:w-32"} shrink-0 rounded-lg object-cover bg-white`}
        />
        <div className="min-w-0 flex-1">
          <p className={`${compact ? "text-[10px]" : "text-xs"} text-amber-700`}>
            {shop.category}
          </p>
          <p className={`${compact ? "mt-1 text-[11px]" : "mt-1.5 text-sm leading-5"} line-clamp-2 text-gray-700`}>
            取り扱い: {shop.products.slice(0, 4).join("・")}
            {shop.products.length > 4 && "..."}
          </p>
        </div>
      </div>

      <Link
        href={mapHref}
        onClick={handleOpenMap}
        className={`inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-3 py-1 font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50 lg:hidden ${
          compact ? "mt-2 text-[10px]" : "mt-2 text-xs"
        }`}
      >
        地図で見る →
      </Link>
    </div>
  );
}

export default memo(ShopResultCard);
