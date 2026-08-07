'use client';

/**
 * FacilityGuidePanel
 *
 * 「おでかけサポート」でカテゴリを選んだときの一覧表示。
 * 店舗検索の結果表示（MapView の SearchResultsSheet）と同じ形にそろえてある：
 *
 *   - ふだんは小さなバッジピルだけ。マップを隠さない
 *   - タップでボトムシートが開き、施設が近い順に並ぶ
 *   - 最寄りの1件は行を強調表示する
 *   - 行をタップするとその施設へマップが寄る
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap } from 'leaflet';
import type { Facility, FacilityCategory } from '@/lib/facilities/facilities';
import { formatDistance, type FacilityWithRoute } from '@/lib/facilities/nearest';

type FacilityGuidePanelProps = {
  category: FacilityCategory;
  /** カテゴリの全施設（現在地が無いときの並び） */
  facilities: Facility[];
  /** 現在地からの道のりが近い順。現在地が無ければ空 */
  ranked: FacilityWithRoute[];
  map: LeafletMap | null;
  onClose: () => void;
};

const FOCUS_ZOOM = 18;

export default function FacilityGuidePanel({
  category,
  facilities,
  ranked,
  map,
  onClose,
}: FacilityGuidePanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dragStartY = useRef<number | null>(null);

  // カテゴリが変わったら閉じた状態に戻す
  useEffect(() => {
    setIsOpen(false);
  }, [category.id]);

  const handleRowTap = useCallback(
    (facility: Facility) => {
      if (!map) return;
      map.flyTo([facility.lat, facility.lng], FOCUS_ZOOM, { animate: true, duration: 0.8 });
      setIsOpen(false);
    },
    [map]
  );

  const handleDragStart = (clientY: number) => {
    dragStartY.current = clientY;
  };
  const handleDragEnd = (clientY: number) => {
    if (dragStartY.current !== null && clientY - dragStartY.current > 60) setIsOpen(false);
    dragStartY.current = null;
  };

  const hasLocation = ranked.length > 0;
  const rows: Array<{ facility: Facility; walk: FacilityWithRoute | null }> = hasLocation
    ? ranked.map((entry) => ({ facility: entry.facility, walk: entry }))
    : facilities.map((facility) => ({ facility, walk: null }));
  const nearestId = hasLocation ? ranked[0].facility.id : null;

  return (
    <>
      {/* バッジピル：たたんでいるときの表示 */}
      {!isOpen && (
        <div
          className="pointer-events-auto absolute left-1/2 z-[1100] -translate-x-1/2"
          style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom,0px) + 0.5rem + 25px)' }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            onTouchStart={(e) => e.stopPropagation()}
            className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 shadow-lg ring-1 ring-black/5 transition-transform active:scale-95"
          >
            <span aria-hidden className="text-base leading-none">
              {category.emoji}
            </span>
            <span className="text-[13px] font-bold text-slate-900">
              {nearestId && ranked[0]
                ? `徒歩${ranked[0].walkMinutes}分・${ranked[0].facility.name}`
                : `${category.label} ${facilities.length}か所`}
            </span>
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0 text-slate-400">
              <path d="M1 5L5 1L9 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      )}

      {/* 背景オーバーレイ */}
      {isOpen && (
        <div
          className="pointer-events-auto absolute inset-0 z-[1620] bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ボトムシート本体 */}
      <div
        className={`pointer-events-auto absolute left-0 right-0 z-[1650] rounded-t-[1.75rem] bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ bottom: 0, maxHeight: '42vh', display: 'flex', flexDirection: 'column' }}
        onTouchStart={(e) => {
          e.stopPropagation();
          handleDragStart(e.touches[0].clientY);
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          handleDragEnd(e.changedTouches[0].clientY);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ドラッグハンドル + ヘッダー */}
        <div
          className="shrink-0 cursor-grab active:cursor-grabbing"
          onTouchStart={(e) => {
            e.stopPropagation();
            handleDragStart(e.touches[0].clientY);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            handleDragEnd(e.changedTouches[0].clientY);
          }}
        >
          <div className="flex justify-center pb-1 pt-3">
            <div className="h-1 w-10 rounded-full bg-slate-300" />
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-2.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
                Odekake Support
              </p>
              <h3 className="text-base font-bold text-slate-900">
                {category.label} {rows.length}か所
              </h3>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-medium text-slate-600 transition-colors active:bg-slate-200"
            >
              表示をやめる
            </button>
          </div>
        </div>

        {/* 一覧は縦スクロール可能 */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom,0px)]">
          {rows.map(({ facility, walk }, i) => {
            const isNearest = facility.id === nearestId;
            return (
              <button
                key={facility.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRowTap(facility);
                }}
                className={`flex w-full items-center gap-3 border-b border-slate-100/80 px-5 py-2.5 text-left transition-colors active:bg-teal-50 ${
                  isNearest ? 'bg-teal-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                }`}
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `${category.markerColor}1a` }}
                  aria-hidden
                >
                  {category.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-tight text-slate-900">
                    {facility.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {isNearest && (
                      <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        最寄り
                      </span>
                    )}
                    {walk ? (
                      <span className="text-[11px] text-slate-500">
                        徒歩{walk.walkMinutes}分・{formatDistance(walk.walkDistanceMeters)}
                      </span>
                    ) : (
                      <span className="truncate text-[11px] text-slate-400">{facility.area}</span>
                    )}
                  </div>
                </div>
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" className="shrink-0 text-slate-300">
                  <path d="M1 1l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
