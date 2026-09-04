'use client';

/**
 * SearchResultsSheet
 *
 * 店舗検索 / AI おすすめの結果一覧を出すボトムシート。
 * ふだんは件数のバッジピルだけを出し、タップで一覧が開く。行をタップするとその店へ寄る。
 * Leaflet 版・MapLibre 版で共用するため、地図は MapCamera だけを使う。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Shop } from '../data/shops';
import type { MapCamera } from '../types/mapCamera';
import { getShopBannerImage } from '../../../../lib/shopImages';

export function SpotlightCountdownBar({ shopId }: { shopId: number }) {
  return (
    <div
      key={shopId}
      className="pointer-events-none absolute left-0 right-0 top-0 z-[1200] h-1 overflow-hidden"
    >
      <div className="h-full w-full origin-left bg-amber-400 opacity-80"
        style={{ animation: "spotlight-drain 2s linear forwards" }}
      />
    </div>
  );
}

// ===== Search results bottom sheet =====
export default function SearchResultsSheet({
  shops,
  searchShopIds,
  map,
  onClearSearch,
  badgeBottom,
}: {
  shops: Shop[];
  searchShopIds: number[];
  map: MapCamera | null;
  onClearSearch?: () => void;
  badgeBottom?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedId, setFocusedId] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartY = useRef<number | null>(null);

  const searchShopSet = useMemo(() => new Set(searchShopIds), [searchShopIds]);
  const searchShops = useMemo(() => {
    const firstShopById = new Map<number, Shop>();
    shops.forEach((shop) => {
      if (searchShopSet.has(shop.id) && !firstShopById.has(shop.id)) {
        firstShopById.set(shop.id, shop);
      }
    });

    const orderedUniqueIds = Array.from(new Set(searchShopIds));
    return orderedUniqueIds
      .map((id) => firstShopById.get(id))
      .filter((shop): shop is Shop => Boolean(shop));
  }, [shops, searchShopIds, searchShopSet]);

  // 検索結果が変わったらシートを閉じる
  useEffect(() => {
    setIsOpen(false);
    setFocusedId(null);
  }, [searchShopIds]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleRowTap = useCallback((shop: Shop) => {
    if (!map) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setFocusedId(shop.id);
    map.flyTo([shop.lat, shop.lng], map.getMaxZoom(), { animate: true, duration: 0.8, easeLinearity: 0.25 });
    timerRef.current = setTimeout(() => {
      setFocusedId(null);
      timerRef.current = null;
    }, 2000);
    setIsOpen(false);
  }, [map]);

  const handleDragStart = (clientY: number) => { dragStartY.current = clientY; };
  const handleDragEnd = (clientY: number) => {
    if (dragStartY.current !== null && clientY - dragStartY.current > 60) setIsOpen(false);
    dragStartY.current = null;
  };

  if (searchShops.length === 0) return null;

  return (
    <>
      {focusedId != null && <SpotlightCountdownBar shopId={focusedId} />}

      {/* バッジピル: 件数タップでシートを開く */}
      {!isOpen && (
        <div
          className="absolute left-1/2 z-[1100] -translate-x-1/2 pointer-events-auto"
          style={{ bottom: badgeBottom ?? 'calc(4.5rem + env(safe-area-inset-bottom,0px) + 0.5rem + 25px)' }}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
            onTouchStart={(e) => e.stopPropagation()}
            className="flex items-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-white shadow-lg active:scale-95 transition-transform"
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="shrink-0">
              <circle cx="5.5" cy="5.5" r="4.5" stroke="white" strokeWidth="1.8"/>
              <path d="M9 9l3 3" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span className="text-[13px] font-bold">{searchShops.length}件のお店</span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0 opacity-80">
              <path d="M1 5L5 1L9 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* 背景オーバーレイ */}
      {isOpen && (
        <div
          className="absolute inset-0 z-[1620] bg-black/20 pointer-events-auto"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ボトムシート本体 */}
      <div
        className={`absolute left-0 right-0 z-[1650] pointer-events-auto rounded-t-[1.75rem] bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 0, maxHeight: '42vh', display: 'flex', flexDirection: 'column' }}
        onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e.touches[0].clientY); }}
        onTouchEnd={(e) => { e.stopPropagation(); handleDragEnd(e.changedTouches[0].clientY); }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ドラッグハンドル + ヘッダー */}
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => { e.stopPropagation(); handleDragStart(e.touches[0].clientY); }}
          onTouchEnd={(e) => { e.stopPropagation(); handleDragEnd(e.changedTouches[0].clientY); }}
        >
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Search Results</p>
              <h3 className="text-base font-bold text-slate-900">{searchShops.length}件のお店</h3>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClearSearch?.(); setIsOpen(false); }}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-medium text-slate-600 active:bg-slate-200 transition-colors"
            >
              検索を解除
            </button>
          </div>
        </div>

        {/* 一覧は縦スクロール可能 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
          {searchShops.map((shop, i) => {
            const bannerSeed = shop.position ?? shop.id;
            const imageUrl = shop.images?.main ?? getShopBannerImage(shop.category, bannerSeed);
            return (
              <button
                key={shop.id}
                type="button"
                onClick={(e) => { e.stopPropagation(); handleRowTap(shop); }}
                className={`flex w-full items-center gap-3 border-b border-slate-100/80 px-5 py-2.5 text-left transition-colors active:bg-amber-50 ${
                  focusedId === shop.id ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                }`}
              >
                <div className="shrink-0 h-10 w-10 overflow-hidden rounded-xl bg-slate-100">
                  {imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-tight text-slate-900">{shop.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {shop.category && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">{shop.category}</span>
                    )}
                    {shop.position && (
                      <span className="text-[11px] text-slate-400">{shop.position}番</span>
                    )}
                  </div>
                </div>
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" className="shrink-0 text-slate-300">
                  <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
