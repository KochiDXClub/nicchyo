'use client';

import { useState } from 'react';
import { Tag, ChevronDown, ChevronUp } from 'lucide-react';
import type { CouponTypeWithParticipants } from '@/lib/coupons/types';

interface SearchDiscoveryProps {
  categories: string[];
  onCategorySelect: (category: string) => void;
  couponTypes?: CouponTypeWithParticipants[];
  selectedCouponTypeId?: string | null;
  onCouponTypeSelect?: (couponTypeId: string | null) => void;
}

const INITIAL_SHOW = 2;

/**
 * 検索ディスカバリーコンポーネント
 * 検索前の「何を探しますか？」状態を表示し、
 * ユーザーが直感的に探索を開始できるようにする
 */
export default function SearchDiscovery({
  categories,
  onCategorySelect,
  couponTypes = [],
  selectedCouponTypeId = null,
  onCouponTypeSelect,
}: SearchDiscoveryProps) {
  const [couponsExpanded, setCouponsExpanded] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);

  const visibleCoupons = couponsExpanded ? couponTypes : couponTypes.slice(0, INITIAL_SHOW);
  const visibleCategories = categoriesExpanded ? categories : categories.slice(0, INITIAL_SHOW);

  return (
    <div className="space-y-3 pt-2 animate-in fade-in duration-500">
      {couponTypes.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2 text-emerald-800">
            <span aria-hidden className="text-sm">🎟️</span>
            <h3 className="text-xs font-bold tracking-wider uppercase">クーポン種類から探す</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleCoupons.map((couponType) => {
              const isActive = selectedCouponTypeId === couponType.id;
              return (
                <button
                  key={couponType.id}
                  type="button"
                  onClick={() => onCouponTypeSelect?.(isActive ? null : couponType.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
                    isActive
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50'
                  }`}
                  aria-pressed={isActive}
                >
                  {couponType.emoji} {couponType.name}
                </button>
              );
            })}
            {couponTypes.length > INITIAL_SHOW && (
              <button
                type="button"
                onClick={() => setCouponsExpanded((v) => !v)}
                className="flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                aria-expanded={couponsExpanded}
              >
                {couponsExpanded ? (
                  <><ChevronUp className="h-3 w-3" />閉じる</>
                ) : (
                  <><ChevronDown className="h-3 w-3" />あと{couponTypes.length - INITIAL_SHOW}件</>
                )}
              </button>
            )}
          </div>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center gap-2 text-amber-800">
          <Tag className="h-3.5 w-3.5" />
          <h3 className="text-xs font-bold tracking-wider uppercase">ジャンルから探す</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleCategories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => onCategorySelect(cat)}
              className="rounded-full border border-amber-100 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:border-amber-300 hover:bg-amber-50 active:scale-95"
            >
              {cat}
            </button>
          ))}
          {categories.length > INITIAL_SHOW && (
            <button
              type="button"
              onClick={() => setCategoriesExpanded((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              aria-expanded={categoriesExpanded}
            >
              {categoriesExpanded ? (
                <><ChevronUp className="h-3 w-3" />閉じる</>
              ) : (
                <><ChevronDown className="h-3 w-3" />あと{categories.length - INITIAL_SHOW}件</>
              )}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
