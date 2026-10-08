'use client';

/**
 * デモの中で開く、店舗バナーの「全開」。
 *
 * 本番でお店をタップすると、写真が主役のバナーが下から画面の9割まで開く
 * （ShopDetailBanner のモバイル drawer）。案内でも同じところまで見せたいので、
 * その並びをそのまま組む。
 *
 *   大きな写真（ShopBannerHero の expanded）→ テーマ色の帯 → 営業情報 → 商品
 *
 * 写真・見出し・営業情報は本番と同じ部品（ShopBannerHero / ShopBusinessInfoCard）を
 * 呼んでいる。商品の欄だけは、本番が価格・季節・お気に入りまで扱う大きな作りなので、
 * 案内では品名の並びに留めている。
 *
 * ShopDetailBanner そのものを持ってこないのは、あれが開くと閲覧数を数えたり
 * body にクラスを付けたりと、案内の中で起こってほしくないことが走るため。
 */

import { motion } from 'framer-motion';
import { Heart, X as XIcon } from 'lucide-react';
import {
  ShopBannerHero,
  ShopBusinessInfoCard,
  resolveBannerTheme,
} from '../ShopBannerHero';
import { getShopBannerImage } from '@/lib/shopImages';
import type { Shop } from '../../types/shopData';

/** 本番の drawer と同じ、枠に対する開き具合（DRAWER_FULL_RATIO） */
export const INTRO_SHEET_RATIO = 0.9;

export default function IntroShopSheet({
  shop,
  isFavorite,
  onToggleFavorite,
  onClose,
}: {
  shop: Shop;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}) {
  const theme = resolveBannerTheme(shop.themeColor);
  const bannerImage = getShopBannerImage(shop.category, shop.id);

  return (
    <motion.div
      key={`intro-sheet-${shop.id}`}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_-10px_30px_-12px_rgba(15,23,42,0.45)]"
      style={{ height: `${INTRO_SHEET_RATIO * 100}%` }}
    >
      {/* たたむための取っ手と閉じる。本番の drawer と同じ位置 */}
      <div className="relative shrink-0 pt-2">
        <div className="flex justify-center">
          <span className="h-1.5 w-10 rounded-full bg-slate-300" aria-hidden />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-3 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain pb-5">
        <div className="px-5 pt-3">
          <ShopBannerHero
            shop={shop}
            bannerImage={bannerImage}
            theme={theme}
            heroImageError={false}
            onImageError={() => {}}
            mode="expanded"
            isFavorite={isFavorite}
            onToggleFavorite={onToggleFavorite}
          />
        </div>

        {/* テーマ色の帯。本番はここで写真と本文を分けている */}
        <div className="mt-4 h-1 w-full" style={{ backgroundColor: theme.accent }} />

        <div className="space-y-4 px-5 pt-5">
          <ShopBusinessInfoCard shop={shop} theme={theme} />

          <div className="rounded-[30px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
            <p
              className="text-xs font-bold uppercase tracking-[0.18em]"
              style={{ color: theme.text }}
            >
              商品
            </p>
            <p className="mt-1 text-sm text-slate-500">
              品ぞろえと価格を並びで見比べやすくしています
            </p>
            {shop.products.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2">
                {shop.products.map((product) => (
                  <li
                    key={product}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] font-semibold text-slate-700"
                  >
                    {product}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-400">商品はまだ登録されていません</p>
            )}
          </div>

          <p className="flex items-center justify-center gap-1.5 text-center text-[11.5px] font-semibold text-slate-400">
            <Heart className="h-3.5 w-3.5" fill={isFavorite ? 'currentColor' : 'none'} />
            {isFavorite
              ? 'お気に入りに入れました。屋根に印が付きます'
              : 'ハートを押すと、あとからまとめて見られます'}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
