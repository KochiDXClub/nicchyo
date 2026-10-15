"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { IntroStallMarker } from "../map/components/intro/IntroStall";
import ShopDetailBanner from "../map/components/ShopDetailBanner";
import { isShopFavorited } from "@/lib/favoriteShops";
import { useFavoriteEntries } from "@/lib/hooks/useFavorites";
import type { IntroDemoShop } from "../map/components/intro/introDemoShops";

/**
 * 写真に写っている屋台の上に、地図と同じ屋台マーカーを置く。タップすると、地図と同じ店舗バナーが開く。
 * 「これは地図のサイトだ」と最初の一画面で分かってもらうための演出。
 *
 * マーカーは map/components/intro の IntroStallMarker（本番の markerHtmlGenerator と同じ HTML）、
 * バナーは地図・相談・お気に入りと同じ ShopDetailBanner をそのまま使う（写真・商品・お気に入りも本物。開くと閲覧数も数えられる）。ここでは置き場所と開閉だけを持つ。
 * 置き場所は写真の屋台に合わせた割合。スマートフォンの縦長写真は先頭2つ、広い画面の横長写真は4つ出す
 */
const SLOTS = [
  { className: "left-[36%] top-[37%] md:left-[36%] md:top-[37%]", side: "north" },
  { className: "left-[57%] top-[41%] md:left-[57%] md:top-[41%]", side: "south" },
  { className: "hidden md:block md:left-[76%] md:top-[49%]", side: "north" },
  { className: "hidden md:block md:left-[89%] md:top-[68%]", side: "south" },
] as const;

export default function LandingHeroMarkers({ shops }: { shops: IntroDemoShop[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const favoriteEntries = useFavoriteEntries();
  const reduceMotion = useReducedMotion();
  const open = shops.find((shop) => shop.id === openId) ?? null;

  return (
    <>
      <div className="absolute inset-0">
        {shops.slice(0, SLOTS.length).map((shop, index) => {
          const slot = SLOTS[index];
          return (
            <motion.div
              key={shop.id}
              className={`absolute ${slot.className}`}
              initial={reduceMotion ? false : { opacity: 0, y: -14, scale: 0.6 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", damping: 14, stiffness: 220, delay: 0.7 + index * 0.18 }}
            >
              <IntroStallMarker
                shop={shop}
                side={slot.side}
                scale={0.9}
                state={{ favorite: isShopFavorited(favoriteEntries, shop.id) }}
                onClick={() => setOpenId(shop.id)}
              />
            </motion.div>
          );
        })}
      </div>

      {open ? <ShopDetailBanner shop={open} onClose={() => setOpenId(null)} reserveBottomNavSpace={false} /> : null}
    </>
  );
}
