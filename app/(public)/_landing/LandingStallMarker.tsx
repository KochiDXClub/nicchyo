"use client";

import { useMemo } from "react";
import { resolveStallColors } from "../map/config/shopCategories";
import { generateStallSpriteSvg, resolveStallParts, STALL_PHOTO_HEIGHT_RATIO } from "../map/config/stallParts";
import { sanitizeCssColor } from "../map/utils/markerHtmlGenerator";
import { getShopThumbnailImage } from "@/lib/shopImages";
import type { Shop } from "../map/types/shopData";

/**
 * 地図の「写真入りの屋台」マーカー（屋根＋縁飾り＋写真の窓＋短い脚。縁はカテゴリの色）。
 *
 * 地図（MapLibre）は map/components/maplibre/stallSprites.ts が generateStallSpriteSvg で同じ絵を作って
 * ビットマップにしている。ここでは同じ関数・同じ色の決め方（resolveStallColors）・同じ写真
 * （getShopThumbnailImage）から SVG を作り、そのまま埋め込む。屋台の絵を直せば、このマーカーも変わる。
 * 写真を <image> で読むので、<img> ではなくインラインの SVG にしている
 */
export default function LandingStallMarker({ shop, onClick }: { shop: Shop; onClick?: () => void }) {
  const svg = useMemo(() => {
    const stall = resolveStallColors(shop.category, sanitizeCssColor(shop.illustration?.color));
    const photo = getShopThumbnailImage(shop).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return generateStallSpriteSvg(
      resolveStallParts({ roof: shop.illustration?.roof, awning: shop.illustration?.awning }),
      {
        roof: stall.base,
        awningBase: stall.light,
        awningStripe: stall.base,
        photo: { href: photo, stroke: stall.dark },
      },
      { width: 100, height: Math.round(100 * STALL_PHOTO_HEIGHT_RATIO) }
    );
  }, [shop]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${shop.name}を開く`}
      className="absolute -translate-x-1/2 -translate-y-full appearance-none border-0 bg-transparent p-0 drop-shadow-md transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none"
    >
      <span
        className="block w-[78px] md:w-[104px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </button>
  );
}
