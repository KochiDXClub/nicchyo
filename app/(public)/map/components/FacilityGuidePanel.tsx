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
 *
 * バッジピルは「状態ラベル（小・色つき）→本文（大・太字）」の2段構成にして、
 * 一番伝えたい情報（施設名や件数）が視線に一番強く残るようにしてある。
 * 色はカテゴリごとの markerColor を使い、お手洗い／休けい／のりもので
 * ひと目で見分けがつくようにする。
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
  const nearest = hasLocation ? ranked[0] : null;

  return (
    <>
      {/* バッジピル：たたんでいるときの表示。
          上段＝状態を示す小さな色つきラベル、下段＝一番伝えたい本文（太字・大きめ） */}
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
            className="flex max-w-[min(88vw,26rem)] items-center gap-2.5 rounded-2xl bg-white py-2 pl-2.5 pr-3.5 shadow-lg ring-1 ring-black/5 transition-transform active:scale-[0.97]"
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
              style={{ backgroundColor: `${category.markerColor}1a` }}
              aria-hidden
            >
              {category.emoji}
            </div>

            <div className="min-w-0 flex-1 text-left">
              <p
                className="text-[10px] font-bold uppercase leading-none tracking-wide"
                style={{ color: category.markerColor }}
              >
                {nearest ? `最寄り・徒歩${nearest.walkMinutes}分` : category.label}
              </p>
              <p className="mt-1 truncate text-[14px] font-bold leading-tight text-slate-900">
                {nearest ? nearest.facility.name : `${facilities.length}か所を表示中`}
              </p>
            </div>

            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className="shrink-0 text-slate-300">
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
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ backgroundColor: `${category.markerColor}1a` }}
                aria-hidden
              >
                {category.emoji}
              </div>
              <div>
                <p
                  className="text-[10px] font-bold uppercase leading-none tracking-wide"
                  style={{ color: category.markerColor }}
                >
                  おでかけサポート
                </p>
                <h3 className="mt-1 text-[15px] font-bold leading-tight text-slate-900">
                  {category.label}
                  <span className="ml-1.5 text-[12px] font-medium text-slate-400">{rows.length}か所</span>
                </h3>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-medium text-slate-600 transition-colors active:bg-slate-200"
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
                className={`flex w-full items-center gap-3 border-b border-slate-100/80 px-5 py-3 text-left transition-colors active:bg-slate-50 ${
                  i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'
                }`}
                style={
                  isNearest
                    ? { backgroundColor: `${category.markerColor}0f`, boxShadow: `inset 3px 0 0 ${category.markerColor}` }
                    : undefined
                }
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
                  style={{ backgroundColor: `${category.markerColor}1a` }}
                  aria-hidden
                >
                  {category.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    {isNearest && (
                      <span
                        className="shrink-0 rounded-full px-1.5 py-[1px] text-[10px] font-bold leading-tight text-white"
                        style={{ backgroundColor: category.markerColor }}
                      >
                        最寄り
                      </span>
                    )}
                    <p
                      className={`truncate leading-tight text-slate-900 ${
                        isNearest ? 'text-[14px] font-bold' : 'text-[13px] font-semibold'
                      }`}
                    >
                      {facility.name}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    {walk ? `徒歩${walk.walkMinutes}分・${formatDistance(walk.walkDistanceMeters)}` : facility.area}
                  </p>
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
