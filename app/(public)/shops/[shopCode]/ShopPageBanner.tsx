'use client';

/**
 * 店舗ページ（/shops/001）の本体。
 *
 * 地図で屋台をタップしたときに出る ShopDetailBanner を、そのまま1ページとして出す。
 * 以前は店名・こだわり・商品タグ・写真を並べただけの簡素な作りで、地図側の
 * バナーと見た目も情報量も違っていた。同じものを出すことで、QR や共有リンクから
 * 来た人も、地図で見た人と同じ体験になる。
 *
 * バナーの「閉じる」は、このページでは地図のその店へ移る動きにする。
 */

import { useRouter } from 'next/navigation';
import ShopDetailBanner from '../../map/components/ShopDetailBanner';
import type { Shop } from '../../map/data/shops';

export default function ShopPageBanner({ shop, shopCode }: { shop: Shop; shopCode: string }) {
  const router = useRouter();
  return (
    <ShopDetailBanner
      shop={shop}
      layout="inline"
      onClose={() => router.push(`/map?shop=${shopCode}`)}
    />
  );
}
