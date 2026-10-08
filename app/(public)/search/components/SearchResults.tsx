'use client';

import type { Shop } from '../../map/data/shops';
import ShopResultCard from './ShopResultCard';
import EmptyState from './EmptyState';
import { Map } from 'lucide-react';

interface SearchResultsProps {
  shops: Shop[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  hasQuery: boolean;
  categories: string[];
  favoriteShopIds: number[];
  onPageSelect?: (page: number) => void;
  onCategoryClick?: (category: string) => void;
  onToggleFavorite?: (shopId: number) => void;
  onSelectShop?: (shop: Shop) => void;
  onOpenMap?: () => void;
  mapLabel?: string;
  enableSearchMapHighlight?: boolean;
}

/**
 * 検索結果一覧コンポーネント
 * 結果件数バッジ、グリッドレイアウト、空状態を管理
 */
export default function SearchResults({
  shops,
  totalCount,
  currentPage,
  totalPages,
  hasQuery,
  categories,
  favoriteShopIds,
  onPageSelect,
  onCategoryClick,
  onToggleFavorite,
  onSelectShop,
  onOpenMap,
  mapLabel,
  enableSearchMapHighlight = false,
}: SearchResultsProps) {
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  // 結果がない場合は空状態を表示
  if (shops.length === 0) {
    return (
      <EmptyState
        hasQuery={hasQuery}
        categories={categories}
        onCategoryClick={onCategoryClick}
      />
    );
  }

  return (
    <>
      <div className="rounded-[1.75rem] border border-amber-200 bg-white/95 p-5 shadow-sm pb-16 md:pb-5">
        {/* ヘッダー: タイトルと結果件数 */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-700">
              検索結果
            </p>
            <h2 className="text-xl font-bold text-gray-900">お店一覧</h2>
            <p className="mt-1 text-xs text-gray-500">関連度の高いお店を先に表示しています</p>
          </div>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-100">
            {totalCount}件
          </span>
        </div>

        {/* デスクトップ向けのマップボタン（リスト上部） */}
        {onOpenMap && (
          <button
            type="button"
            onClick={onOpenMap}
            className="mt-4 hidden w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100"
          >
            マップで見る{mapLabel ? `（${mapLabel}）` : ''}
          </button>
        )}

        {/* 検索結果グリッド */}
        <div className="mt-4 space-y-3">
          {shops.map((shop) => (
            <ShopResultCard
              key={shop.id}
              shop={shop}
              isFavorite={favoriteShopIds.includes(shop.id)}
              onToggleFavorite={onToggleFavorite}
              onSelectShop={onSelectShop}
              enableSearchMapHighlight={enableSearchMapHighlight}
            />
          ))}
        </div>

        {totalCount > 10 && (
          <div className="mt-6 flex flex-col items-center gap-3 border-t border-amber-100 pt-5">
            <p className="text-xs font-medium text-gray-500">
              {currentPage} / {totalPages} ページ
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {pageNumbers.map((pageNumber) => {
                const isActive = pageNumber === currentPage;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => onPageSelect?.(pageNumber)}
                    aria-current={isActive ? "page" : undefined}
                    className={`min-w-10 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm transition ${
                      isActive
                        ? "border-amber-200 bg-amber-600 text-white"
                        : "border-amber-200 bg-white text-amber-900 hover:bg-amber-50"
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* モバイル向けのフローティングマップボタン（画面下部固定） */}
      {onOpenMap && (
        <div className="fixed bottom-24 left-0 right-0 z-30 flex justify-center px-4 md:hidden animate-in slide-in-from-bottom-5 duration-500 pointer-events-none">
          <button
            type="button"
            onClick={onOpenMap}
            className="pointer-events-auto flex items-center gap-2 rounded-full border-2 border-white bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-900/20 transition active:scale-95"
          >
            <Map className="h-4 w-4" />
            <span>マップで見る ({totalCount}件)</span>
          </button>
        </div>
      )}
    </>
  );
}
