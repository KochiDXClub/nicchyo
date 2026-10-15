"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import LandingStallMarker from "./LandingStallMarker";
import ShopDetailBanner from "../map/components/ShopDetailBanner";
import type { IntroDemoShop } from "../map/components/intro/introDemoShops";

/**
 * 写真に写っている屋台の上に、地図と同じ屋台マーカーを置く。タップすると、地図と同じ店舗バナーが開く。
 * 「これは地図のサイトだ」と最初の一画面で分かってもらうための演出。
 *
 * マーカーは地図の写真入り屋台と同じ絵（LandingStallMarker）、
 * バナーは地図・相談・お気に入りと同じ ShopDetailBanner をそのまま使う（写真・商品・お気に入りも本物。開くと閲覧数も数えられる）。ここでは置き場所と開閉だけを持つ。
 * 置き場所は写真の屋台に合わせた割合。スマートフォンの縦長写真は先頭2つ、広い画面の横長写真は4つ出す
 */
const SLOTS = [
  { className: "left-[36%] top-[37%]" },
  { className: "left-[57%] top-[41%]" },
  { className: "hidden md:block md:left-[76%] md:top-[49%]" },
  { className: "hidden md:block md:left-[89%] md:top-[68%]" },
] as const;

export default function LandingHeroMarkers({ shops }: { shops: IntroDemoShop[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
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
              <LandingStallMarker shop={shop} onClick={() => setOpenId(shop.id)} />
            </motion.div>
          );
        })}
      </div>

      {open ? <ShopDetailBanner shop={open} onClose={() => setOpenId(null)} reserveBottomNavSpace={false} /> : null}
    </>
  );
}
