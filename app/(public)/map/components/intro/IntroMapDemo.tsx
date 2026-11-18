'use client';

import { IntroDemoFrame, IntroRoad, IntroStallMarker } from './IntroStall';
import type { IntroDemoShop } from './introDemoShops';

// 本番と同じ縦向きの通りに、写真の丸窓を見比べられる間隔で3軒並べる。
const STALL_POSITIONS = ['30%', '55%', '80%'];

// 店舗バナーは、操作時にデモ枠で切れないよう、親の MapIntroPanel が案内全体の上に開く。
export default function IntroMapDemo({
  shops,
  frameHeight,
  favoriteIds,
  selectedShopId,
  onSelectShop,
}: {
  shops: IntroDemoShop[];
  frameHeight: number;
  favoriteIds: number[];
  selectedShopId: number | null;
  onSelectShop: (shop: IntroDemoShop) => void;
}) {
  return (
    <IntroDemoFrame height={frameHeight}>
      <IntroRoad>
        {shops.slice(0, STALL_POSITIONS.length).map((shop, index) => (
          <div key={shop.id} className="absolute left-[33%]" style={{ top: STALL_POSITIONS[index] }}>
            <IntroStallMarker
              shop={shop}
              side="south"
              scale={0.85}
              state={{
                selected: selectedShopId === shop.id,
                favorite: favoriteIds.includes(shop.id),
              }}
              onClick={() => onSelectShop(shop)}
            />
          </div>
        ))}
      </IntroRoad>
    </IntroDemoFrame>
  );
}
