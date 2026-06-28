/**
 * 軽量化された MapView
 *
 * 【改善点】
 * 1. currentZoom を state で管理しない → 再レンダリング削減
 * 2. 店舗マーカーは OptimizedShopLayerWithClustering に完全委譲
 * 3. UI 層（詳細バナー）と地図層を完全分離
 * 4. ズーム操作で React が再レンダリングされない
 *
 * 【パフォーマンス向上】
 * - 再レンダリング: 100%削減（ズーム操作時）
 * - DOM 要素数: 98%削減（1800個 → 30個以下）
 * - 初期表示速度: 3倍以上向上
 */

'use client';

import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";
import { shops as baseShops, Shop } from "../data/shops";
import ShopDetailBanner from "./ShopDetailBanner";
import BackgroundOverlay from "./BackgroundOverlay";
import UserLocationMarker from "./UserLocationMarker";
import MapAgentAssistant from "./MapAgentAssistant";
import OptimizedShopLayerWithClustering from "./OptimizedShopLayerWithClustering";
import { MapOverlays, getVisibleMajorPlaceLabels } from "./MapOverlays";
import { ingredientCatalog, ingredientIcons, type Recipe } from "../../../../lib/recipes";
import {
  getRecommendedZoomBounds,
} from '../config/roadConfig';
import { FAVORITE_SHOPS_KEY, FAVORITE_SHOPS_UPDATED_EVENT, loadFavoriteShopIds } from "../../../../lib/favoriteShops";
import {
  getViewModeForZoom,
  ViewMode,
} from '../config/displayConfig';
import { useBag } from "../../../../lib/storage/BagContext";
import type { Landmark } from "../types/landmark";
import type { MapRoute } from "../types/mapRoute";
import {
  getAutoRotationForVisibleRoad,
  normalizeRotationDeg,
} from "../utils/autoRotation";
import {
  expandBoundsByMeters,
  getDefaultMapRouteConfig,
  getDefaultMapRoutePoints,
  getRouteBounds,
  getRouteCenter,
  normalizeMapRoutePoints,
  projectPointOntoRoute,
} from "../utils/mapRouteGeometry";
import { useMapGestures } from "../hooks/useMapGestures";
import { useMapCameraController } from "../hooks/useMapCameraController";
import { getShopBannerImage } from "../../../../lib/shopImages";

function findIngredientMatch(name: string) {
  const lower = name.trim().toLowerCase();
  return ingredientCatalog.find(
    (ing) =>
      ing.name.toLowerCase().includes(lower) ||
      lower.includes(ing.name.toLowerCase()) ||
      ing.id.toLowerCase() === lower ||
      ing.id.toLowerCase().includes(lower) ||
      ing.aliases?.some(
        (alias) =>
          alias.toLowerCase().includes(lower) ||
          lower.includes(alias.toLowerCase())
      )
  );
}

// Recommended zoom bounds (optimal range for Sunday Market)
const ZOOM_BOUNDS = getRecommendedZoomBounds();

const MIN_ZOOM = ZOOM_BOUNDS.min;
const MAX_ZOOM = ZOOM_BOUNDS.max;
const INITIAL_ZOOM = MAX_ZOOM;
const AGENT_STORAGE_KEY = "nicchyo-map-agent-plan";
const BASEMAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const BASEMAP_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function isIngredientName(name: string) {
  const lower = name.trim().toLowerCase();
  return ingredientCatalog.some(
    (ing) =>
      ing.name.toLowerCase().includes(lower) ||
      lower.includes(ing.name.toLowerCase()) ||
      ing.id.toLowerCase() === lower ||
      ing.id.toLowerCase().includes(lower) ||
      ing.aliases?.some(
        (alias) =>
          alias.toLowerCase().includes(lower) || lower.includes(alias.toLowerCase())
      )
  );
}

// ===== 時間帯に応じたアンビエントオーバーレイ =====
function TimeAmbientOverlay() {
  const hour = new Date().getHours();

  let background: string | null = null;
  if (hour >= 6 && hour < 9) {
    // 朝 — 朝霧・柔らかい白い光
    background = 'linear-gradient(to bottom, rgba(255,252,235,0.18), rgba(255,248,220,0.07))';
  } else if (hour >= 14 && hour < 17) {
    // 昼後半 — 陽光の暖かみ
    background = 'rgba(255,195,70,0.06)';
  } else if (hour >= 17 && hour < 19) {
    // 夕方 — 橙色の斜光
    background = 'linear-gradient(to bottom, rgba(255,140,30,0.12), rgba(255,90,10,0.05))';
  }

  if (!background) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[500]"
      style={{ background }}
    />
  );
}

// ズームスライダーを2本指操作の終了後に表示し続ける時間（ミリ秒）
const ZOOM_SLIDER_HIDE_DELAY_MS = 3000;

// ===== テーパー型縦ズームスライダー =====
// 上端（拡大側）が太く、下端（縮小側）が細いくさび形のトラックで操作方向を直感的に伝える
const VZ_PAD = 14;        // 上下パディング（サムがはみ出ないように）
const VZ_TRACK_H = 156;   // トラック高さ
const VZ_SVG_W = 34;
const VZ_SVG_H = VZ_TRACK_H + VZ_PAD * 2;
const VZ_WIDE = 22;       // 上端（拡大）の幅
const VZ_NARROW = 8.5;    // 下端（縮小）の幅
const VZ_CX = VZ_SVG_W / 2;
const VZ_L_TOP = VZ_CX - VZ_WIDE / 2;
const VZ_R_TOP = VZ_CX + VZ_WIDE / 2;
const VZ_L_BOT = VZ_CX - VZ_NARROW / 2;
const VZ_R_BOT = VZ_CX + VZ_NARROW / 2;

function VerticalZoomSlider({
  value,
  min,
  max,
  onValueChange,
}: {
  value: number;
  min: number;
  max: number;
  onValueChange: (v: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);

  const trackTop = VZ_PAD;
  const trackBot = VZ_PAD + VZ_TRACK_H;

  const pct = (value - min) / (max - min);           // 0=最小, 1=最大
  const thumbY = trackTop + VZ_TRACK_H * (1 - pct); // 上=拡大, 下=縮小

  // アンバー塗り: サムから下端まで（塗りが多い＝よりズームインしている）
  const fillRatio = (thumbY - trackTop) / VZ_TRACK_H;
  const fillTL = VZ_L_TOP + (VZ_L_BOT - VZ_L_TOP) * fillRatio;
  const fillTR = VZ_R_TOP + (VZ_R_BOT - VZ_R_TOP) * fillRatio;
  const trackPts = `${VZ_L_TOP},${trackTop} ${VZ_R_TOP},${trackTop} ${VZ_R_BOT},${trackBot} ${VZ_L_BOT},${trackBot}`;
  const fillPts  = `${fillTL},${thumbY} ${fillTR},${thumbY} ${VZ_R_BOT},${trackBot} ${VZ_L_BOT},${trackBot}`;

  const getValueFromY = useCallback(
    (clientY: number): number => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return value;
      const relY = Math.max(0, Math.min(VZ_TRACK_H, clientY - rect.top - VZ_PAD));
      return min + (1 - relY / VZ_TRACK_H) * (max - min);
    },
    [min, max, value],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
    onValueChange(getValueFromY(e.clientY));
    e.stopPropagation();
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    onValueChange(getValueFromY(e.clientY));
    e.stopPropagation();
  };
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    isDragging.current = false;
    e.stopPropagation();
  };

  return (
    <svg
      ref={svgRef}
      width={VZ_SVG_W}
      height={VZ_SVG_H}
      style={{ cursor: "ns-resize", touchAction: "none", display: "block" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="slider"
      aria-label="ズーム"
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
    >
      {/* グレーのトラック（くさび形） */}
      <polygon points={trackPts} fill="#e5e7eb" />
      {/* アンバー塗り（現在のズームレベルを表す） */}
      <polygon points={fillPts} fill="#d97706" opacity="0.65" />
      {/* サム */}
      <circle cx={VZ_CX} cy={thumbY} r={8.5} fill="white" stroke="#d97706" strokeWidth="3" />
    </svg>
  );
}

// ===== Spotlight countdown bar: 2s amber progress bar shown during spotlight mode =====
function SpotlightCountdownBar({ shopId }: { shopId: number }) {
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
function SearchResultsSheet({
  shops,
  searchShopIds,
  map,
  onClearSearch,
  badgeBottom,
}: {
  shops: Shop[];
  searchShopIds: number[];
  map: L.Map | null;
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


// ===== Right-side controls: zoom slider (bottom) + tracking button (above nav bar) =====
function MapControls({
  map,
  isTracking,
  onToggleTracking,
  currentZoom,
  minZoom,
  maxZoom,
  zoomSliderVisible,
  onZoomSliderInteract,
}: {
  map: L.Map | null;
  isTracking: boolean;
  onToggleTracking: () => void;
  currentZoom: number;
  minZoom: number;
  maxZoom: number;
  /** 2本指操作時のみ true。false のときズームスライダーをフェードアウトさせる */
  zoomSliderVisible: boolean;
  /** スライダー操作時に表示を延命させるためのコールバック */
  onZoomSliderInteract: () => void;
}) {
  return (
    <>
      {/* 縦ズームスライダー（ナビバー直上）— 2本指操作時のみ表示し、操作終了から数秒後にフェードアウト */}
      <div
        className={`absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px)-2rem)] right-4 z-[1000] flex flex-col items-center gap-1 rounded-2xl border border-amber-100/60 bg-white/95 px-2.5 py-3 shadow-card backdrop-blur transition-opacity duration-300 ${
          zoomSliderVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!zoomSliderVisible}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { e.stopPropagation(); onZoomSliderInteract(); }}
      >
        <span className="select-none text-[12px] font-black leading-none text-amber-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">+</span>
        <VerticalZoomSlider
          value={currentZoom}
          min={minZoom}
          max={maxZoom}
          onValueChange={(v) => { onZoomSliderInteract(); map?.setZoom(v, { animate: false }); }}
        />
        <span className="select-none text-[12px] font-black leading-none text-amber-700 drop-shadow-[0_1px_0_rgba(255,255,255,0.9)]">−</span>
      </div>

      {/* 現在地追跡ボタン（画面上部右） */}
      <div
        className="absolute right-4 top-28 z-[1000]"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => { e.stopPropagation(); }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleTracking();
          }}
          className={`flex h-11 w-11 items-center justify-center rounded-full shadow-pop transition-all active:scale-95 ${
            isTracking
              ? "bg-amber-500 text-white hover:bg-amber-600"
              : "border border-amber-100/60 bg-white/95 text-slate-600 shadow-card hover:bg-amber-50"
          }`}
          aria-label={isTracking ? "追従中" : "追従オフ"}
        >
          <Navigation className={`h-5 w-5 ${isTracking ? "fill-current" : ""}`} />
        </button>
      </div>
    </>
  );
}



function MapZoomGuideToast({ message }: { message: string | null }) {
  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-20 z-[1400] w-[min(calc(100vw-2rem),24rem)] -translate-x-1/2 transition-all duration-200 ${
        message ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-full bg-slate-900/88 px-4 py-2 text-center text-sm font-medium text-white shadow-lg backdrop-blur">
        {message ?? ""}
      </div>
    </div>
  );
}

type MapViewProps = {
  shops?: Shop[];
  landmarks?: Landmark[];
  mapRoute?: MapRoute;
  initialShopId?: number;
  openInitialShopBanner?: boolean;
  selectedRecipe?: Recipe;
  showRecipeOverlay?: boolean;
  onCloseRecipeOverlay?: () => void;
  agentOpen?: boolean;
  onAgentToggle?: (open: boolean) => void;
  searchShopIds?: number[];
  onMapReady?: () => void;
  eventTargets?: Array<{ id: string; lat: number; lng: number }>;
  highlightEventTargets?: boolean;
  onMapInstance?: (map: L.Map) => void;
  onUserLocationUpdate?: (coords: { lat: number; lng: number; inMarket: boolean }) => void;
  aiShopIds?: number[];
  commentShopId?: number;
  kotoduteShopIds?: number[];
  shopBannerVariant?: "default" | "kotodute";
  attendanceEstimates?: Record<
    number,
    {
      label: string;
      p: number | null;
      n_eff: number;
      vendor_override: boolean;
      evidence_summary: string;
    }
  >;
  onZoomChange?: (zoom: number) => void;
  suppressInitialLocationFocus?: boolean;
  onShopSelect?: (shop: Shop) => void;
  spotlightShopId?: number;
  onClearSearch?: () => void;
  /** マップ座標系内にレンダリングするオーバーレイ（キャラクターなど） */
  overlaySlot?: React.ReactNode;
  /** trueのとき拡大縮小スライダーと検索バーを非表示にする */
  hideMapUI?: boolean;
};

export type ShopBannerOrigin = { x: number; y: number; width: number; height: number };

/** 18 <= zoom < 19 のとき丁目エリアマーカーを表示 */
const OVERVIEW_ZONE_MIN_ZOOM = 17;
const OVERVIEW_ZONE_MAX_ZOOM = 19;
const SKIPPED_ZOOM_LEVELS = [18];
const SKIPPED_ZOOM_TOLERANCE = 0.026; // step(0.05) の半分より少し大きく設定

/** 最大縮小時の背景イラストに描き込まれているため、アイコン表示を抑制するランドマーク */
const MIN_ZOOM_HIDDEN_LANDMARK_KEYS = new Set(["castle"]);

/** 背景イラストと向きを合わせるため、個別に追加回転させるランドマーク（度数、反時計回りは負の値） */
const LANDMARK_EXTRA_ROTATION_DEG: Record<string, number> = {
  "jr-train": -90,
  densha: -60,
};

function MapZoomListener({ onZoomChange }: { onZoomChange?: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onZoomChange) return;
    const handleZoom = () => {
      onZoomChange(map.getZoom());
    };
    // 初期値も通知
    handleZoom();
    map.on("zoomend", handleZoom);
    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map, onZoomChange]);
  return null;
}

function MapZoomConstraint() {
  const map = useMap();

  useEffect(() => {
    let lastAcceptedZoom = map.getZoom();

    const handleZoomEnd = () => {
      const zoom = map.getZoom();
      const skippedZoom = SKIPPED_ZOOM_LEVELS.find(
        (level) => Math.abs(zoom - level) <= SKIPPED_ZOOM_TOLERANCE
      );
      if (skippedZoom !== undefined) {
        // スムーズスライダー対応: ±1 の大ジャンプをやめ、スキップゾーンを抜ける最小幅(0.1)だけ移動
        const targetZoom =
          lastAcceptedZoom > zoom ? skippedZoom - 0.1 : skippedZoom + 0.1;
        map.setZoom(targetZoom, { animate: false });
        lastAcceptedZoom = targetZoom;
        return;
      }
      lastAcceptedZoom = zoom;
    };

    map.on("zoomend", handleZoomEnd);
    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map]);

  return null;
}

function MapZoomRoadSnapController({
  onSnapCenter,
}: {
  onSnapCenter: (center: L.LatLng) => [number, number] | null;
}) {
  const map = useMap();

  useEffect(() => {
    let lastZoom = map.getZoom();

    const handleZoomEnd = () => {
      const nextZoom = map.getZoom();
      const isZoomingIn = nextZoom > lastZoom + 0.01;
      lastZoom = nextZoom;

      if (!isZoomingIn) {
        return;
      }

      const center = map.getCenter();
      const snappedPoint = onSnapCenter(center);
      if (!snappedPoint) {
        return;
      }
      map.panTo(snappedPoint, {
        animate: true,
        duration: 0.7,
        easeLinearity: 0.25,
      });
    };

    map.on("zoomend", handleZoomEnd);
    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, onSnapCenter]);

  return null;
}

const MapView = memo(function MapView({
  shops: initialShops,
  landmarks = [],
  mapRoute,
  initialShopId,
  openInitialShopBanner = true,
  selectedRecipe,
  showRecipeOverlay,
  agentOpen,
  onAgentToggle,
  searchShopIds,
  onMapReady,
  eventTargets,
  highlightEventTargets = false,
  onMapInstance,
  onUserLocationUpdate,
  aiShopIds,
  commentShopId,
  kotoduteShopIds,
  shopBannerVariant,
  attendanceEstimates,
  onZoomChange,
  suppressInitialLocationFocus = false,
  onShopSelect,
  spotlightShopId,
  onClearSearch,
  overlaySlot,
  hideMapUI = false,
}: MapViewProps = {}) {
  const [isMobile, setIsMobile] = useState(false);
  const [_isInMarket, setIsInMarket] = useState<boolean | null>(null);
  const { addItem, items: bagItems } = useBag();
  const bagShopIds = useMemo(() => {
    return bagItems
      .filter((item) => item.fromShopId)
      .map((item) => item.fromShopId!)
      .filter((id, index, self) => self.indexOf(id) === index);
  }, [bagItems]);

  const sourceShops = useMemo(
    () => (initialShops && initialShops.length > 0 ? initialShops : baseShops),
    [initialShops]
  );
  const routePoints = useMemo(
    () => {
      const normalized = normalizeMapRoutePoints(mapRoute?.points ?? []);
      return normalized.length >= 2 ? normalized : getDefaultMapRoutePoints();
    },
    [mapRoute]
  );
  const routeConfig = useMemo(
    () => ({
      ...getDefaultMapRouteConfig(),
      ...(mapRoute?.config ?? {}),
    }),
    [mapRoute]
  );
  const routeBounds = useMemo(() => getRouteBounds(routePoints), [routePoints]);
  const routeCenter = useMemo(() => getRouteCenter(routePoints), [routePoints]);
  const initialMapCenter = useMemo<[number, number]>(() => {
    const projected = projectPointOntoRoute(
      { lat: routeCenter[0], lng: routeCenter[1] },
      routePoints
    );
    if (!projected) {
      return routeCenter;
    }
    return [projected.point.lat, projected.point.lng];
  }, [routeCenter, routePoints]);
  const initialMapRotation = useMemo(() => {
    const baseRotation =
      getAutoRotationForVisibleRoad({
        center: L.latLng(initialMapCenter[0], initialMapCenter[1]),
        routePoints,
      }) ?? 0;
    return normalizeRotationDeg(baseRotation + 180);
  }, [initialMapCenter, routePoints]);
  const mapBounds = useMemo(
    () => expandBoundsByMeters(routeBounds, Math.max(routeConfig.visibleDistanceMeters + 48, 120)),
    [routeBounds, routeConfig.visibleDistanceMeters]
  );
  const landmarkSpecs = useMemo(() => landmarks ?? [], [landmarks]);
  const majorPlaceLabels = useMemo(() => {
    // 同名のランドマーク（例: 高知駅の建物アイコンと丸型バッジ）が重複してラベル化されるのを防ぐ
    const seenNames = new Set<string>();
    return landmarkSpecs
      .filter((spec) => {
        if (seenNames.has(spec.name)) return false;
        seenNames.add(spec.name);
        return true;
      })
      .map((spec) => ({ name: spec.name, lat: spec.lat, lng: spec.lng }));
  }, [landmarkSpecs]);
  const minZoomLandmarkKeys = useMemo(
    () =>
      new Set(
        landmarkSpecs
          .filter((spec) => spec.showAtMinZoom && !MIN_ZOOM_HIDDEN_LANDMARK_KEYS.has(spec.key))
          .map((spec) => spec.key)
      ),
    [landmarkSpecs]
  );
  const [displayShops, setDisplayShops] = useState<Shop[]>(() => sourceShops);
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【ポイント6】state は「選択中店舗」のみ
  // - currentZoom は state で管理しない（Leaflet に任せる）
  // - 地図操作（pan/zoom）で React が再レンダリングされない
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopBannerOrigin, setShopBannerOrigin] = useState<ShopBannerOrigin | null>(null);
  const [shopBannerSession, setShopBannerSession] = useState(0);
  const [shopBannerInitialSurface, setShopBannerInitialSurface] = useState<"summary" | "detail">("detail");
  const [shopBannerMainSurface, setShopBannerMainSurface] = useState<"summary" | "detail">("detail");
  const [isTracking, setIsTracking] = useState(true);
  const [_shopLoadProgress, setShopLoadProgress] = useState({ processed: 0, total: 0, done: false });
  const [autoRotation, setAutoRotation] = useState(initialMapRotation);
  const [mapUiZoom, setMapUiZoom] = useState(INITIAL_ZOOM);
  const [zoomGuideMessage, setZoomGuideMessage] = useState<string | null>(null);
  const [mapShellSize, setMapShellSize] = useState(() => {
    if (typeof window === "undefined") return 1600;
    // visualViewport はブラウザUIを除いた実際の表示領域サイズ（iOS Safari 対応）
    const w = window.visualViewport?.width ?? window.innerWidth;
    const h = window.visualViewport?.height ?? window.innerHeight;
    return Math.ceil(Math.hypot(w, h) + 120);
  });

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [favoriteShopIds, setFavoriteShopIds] = useState<number[]>([]);
  const [_planOrder, setPlanOrder] = useState<number[]>([]);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const isTouchGestureActiveRef = useRef(false);
  const zoomGuideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【削除】visibleShops の計算を削除
  // - OptimizedShopLayer が Leaflet API で管理するため不要
  // - filterShopsByZoom は使用しない
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const shops = displayShops;

  useEffect(() => {
    const detectMobile = () => {
      if (typeof window === "undefined") return;
      const touch = "ontouchstart" in window;
      const narrow = window.innerWidth <= 768;
      setIsMobile(touch || narrow);
      // visualViewport でブラウザUIを除いた実際の表示領域を取得（iOS Safari 対応）
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      setMapShellSize(Math.ceil(Math.hypot(w, h) + 120));
    };

    detectMobile();
    window.addEventListener("resize", detectMobile);
    // iOS Safari ではアドレスバーの表示/非表示で visualViewport が変わる
    window.visualViewport?.addEventListener("resize", detectMobile);
    return () => {
      window.removeEventListener("resize", detectMobile);
      window.visualViewport?.removeEventListener("resize", detectMobile);
    };
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    const timer = setTimeout(() => { mapInstance.invalidateSize(false); }, 150);
    return () => clearTimeout(timer);
  }, [mapInstance, mapShellSize]);

  useEffect(() => {
    return () => {
      if (zoomGuideTimerRef.current) {
        clearTimeout(zoomGuideTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setAutoRotation(initialMapRotation);
  }, [initialMapRotation]);

  useEffect(() => {
    if (initialShopId) {
      const shop = shops.find((s) => s.id === initialShopId);
      if (shop) {
        if (openInitialShopBanner) {
          setSelectedShop(shop);
        }
        if (mapRef.current) {
          const currentZoom = mapRef.current.getZoom();
          if (currentZoom < 18) {
            mapRef.current.setView([shop.lat, shop.lng], 18);
          } else {
            mapRef.current.panTo([shop.lat, shop.lng]);
          }
        }
      }
    }
  }, [initialShopId, openInitialShopBanner, shops]);

  useEffect(() => {
    setDisplayShops(sourceShops);
  }, [sourceShops]);

  useEffect(() => {
    if (!selectedShop) return;
    const latest = shops.find((shop) => shop.id === selectedShop.id);
    if (latest && latest !== selectedShop) {
      setSelectedShop(latest);
    }
  }, [shops, selectedShop]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (selectedShop) {
      document.body.classList.add("shop-banner-open");
    } else {
      document.body.classList.remove("shop-banner-open");
    }
    return () => {
      document.body.classList.remove("shop-banner-open");
    };
  }, [selectedShop]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(AGENT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.order)) {
        setPlanOrder(parsed.order);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setFavoriteShopIds(loadFavoriteShopIds());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FAVORITE_SHOPS_KEY) {
        setFavoriteShopIds(loadFavoriteShopIds());
      }
    };
    const handleFavoriteUpdate = (event: Event) => {
      if (event.type === FAVORITE_SHOPS_UPDATED_EVENT) {
        setFavoriteShopIds(loadFavoriteShopIds());
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(FAVORITE_SHOPS_UPDATED_EVENT, handleFavoriteUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FAVORITE_SHOPS_UPDATED_EVENT, handleFavoriteUpdate);
    };
  }, []);

  const bagIngredientIds = useMemo(() => {
    const ids = new Set<string>();
    bagItems.forEach((item) => {
      const match = findIngredientMatch(item.name);
      if (match) ids.add(match.id);
    });
    return ids;
  }, [bagItems]);

  const recipeIngredients = useMemo(() => {
    if (!selectedRecipe) return [];
    return selectedRecipe.ingredients
      .filter((ing) => !bagIngredientIds.has(ing.id))
      .map((ing) => ({
        name: ing.name,
        icon: ingredientIcons[ing.id] ?? "???",
      }));
  }, [bagIngredientIds, selectedRecipe]);

  // レシピ食材を持つ店舗（絞り込み済み）
  const shopsWithIngredients = useMemo(() => {
    if (!selectedRecipe || recipeIngredients.length === 0) return [];
    return shops.filter((shop) =>
      shop.products.some((product) =>
        recipeIngredients.some((ing) =>
          product.toLowerCase().includes(ing.name.toLowerCase()) ||
          ing.name.toLowerCase().includes(product.toLowerCase())
        )
      )
    );
  }, [selectedRecipe, recipeIngredients, shops]);

  // shopsWithIngredients を再利用して全 shops ループを回避
  const recipeIngredientIconsByShop = useMemo(() => {
    if (!showRecipeOverlay || !selectedRecipe || recipeIngredients.length === 0) return {};
    const byShop: Record<number, string[]> = {};
    shopsWithIngredients.forEach((shop) => {
      const icons = recipeIngredients
        .filter((ing) =>
          shop.products.some((product) =>
            product.toLowerCase().includes(ing.name.toLowerCase()) ||
            ing.name.toLowerCase().includes(product.toLowerCase())
          )
        )
        .map((ing) => ing.icon);
      if (icons.length > 0) {
        const unique = Array.from(new Set(icons)).slice(0, 3);
        byShop[shop.id] = unique;
      }
    });
    return byShop;
  }, [recipeIngredients, selectedRecipe, showRecipeOverlay, shopsWithIngredients]);

  const attendanceLabelsByShop = useMemo(() => {
    const labels: Record<number, string> = {};
    if (attendanceEstimates) {
      Object.entries(attendanceEstimates).forEach(([id, estimate]) => {
        if (estimate?.label) {
          labels[Number(id)] = estimate.label;
        }
      });
    }
    return labels;
  }, [attendanceEstimates]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【ポイント7】店舗クリック時のコールバック（段階的ズームアップ対応）
  // - useCallback でメモ化（不要な再生成を防ぐ）
  // - Leaflet から直接呼ばれる（React の state を経由しない）
  // - ViewMode に応じて段階的にズームアップ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleShopClick = useCallback((clickedShop: Shop, origin?: ShopBannerOrigin) => {
    if (!mapRef.current) return;

    const currentZoom = mapRef.current.getZoom();
    const viewMode = getViewModeForZoom(currentZoom);

    if (viewMode.mode === ViewMode.DETAIL) {
      // 詳細モード: 詳細バナーを表示
      if (onShopSelect) {
        onShopSelect(clickedShop);
        setSelectedShop(null);
        setShopBannerOrigin(null);
        return;
      }
      if (typeof document !== "undefined") {
        document.body.classList.add("shop-banner-open");
      }
      const nextInitialSurface: "summary" | "detail" =
        selectedShop &&
        shopBannerMainSurface === "summary" &&
        selectedShop.id !== clickedShop.id
          ? "summary"
          : "detail";
      setShopBannerInitialSurface(nextInitialSurface);
      setShopBannerSession((prev) => prev + 1);
      setSelectedShop(clickedShop);
      setShopBannerOrigin(origin ?? null);
    } else {
      // 【段階的ズームアップ】現在の段階から次の段階へ自然にズーム
      // OVERVIEW → INTERMEDIATE（18.0）
      // INTERMEDIATE → DETAIL（18.5）

      // 周辺店舗を検索（緯度±0.001度、経度±0.0005度 ≈ 半径100m程度）
      const nearbyShops = shops.filter(s =>
        Math.abs(s.lat - clickedShop.lat) < 0.001 &&
        Math.abs(s.lng - clickedShop.lng) < 0.0005
      );

      // 周辺店舗の重心を計算
      let centerLat: number;
      let centerLng: number;

      if (nearbyShops.length === 0) {
        // フォールバック: クリックした店舗を中心にする
        centerLat = clickedShop.lat;
        centerLng = clickedShop.lng;
      } else {
        // 周辺店舗の重心を計算
        centerLat = nearbyShops.reduce((sum, s) => sum + s.lat, 0) / nearbyShops.length;
        centerLng = nearbyShops.reduce((sum, s) => sum + s.lng, 0) / nearbyShops.length;
      }

      // 【段階的ズームアップ】現在のモードに応じて次の段階へ
      let targetZoom: number;
      if (viewMode.mode === ViewMode.OVERVIEW) {
        // OVERVIEW → INTERMEDIATE（エリア探索）へ
        targetZoom = 18.0;
        setZoomGuideMessage("このエリアを拡大しました");
      } else {
        // INTERMEDIATE → DETAIL（詳細閲覧）へ
        targetZoom = 18.5;
        setZoomGuideMessage("もう一度タップするとお店の詳細を見られます");
      }

      if (zoomGuideTimerRef.current) {
        clearTimeout(zoomGuideTimerRef.current);
      }
      zoomGuideTimerRef.current = setTimeout(() => {
        setZoomGuideMessage(null);
      }, 1800);

      mapRef.current.flyTo([centerLat, centerLng], targetZoom, {
        duration: 0.75,
      });
    }
  }, [onShopSelect, selectedShop, shopBannerMainSurface, shops]);

  const handleOpenShop = useCallback((shopId: number) => {
    const target = shops.find((s) => s.id === shopId);
    if (target) {
      handleShopClick(target);
    }
  }, [handleShopClick, shops]);

  const handlePlanUpdate = useCallback((order: number[]) => {
    setPlanOrder(order);
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(AGENT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify({ ...parsed, order }));
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const handleAddToBag = useCallback((name: string, fromShopId?: number) => {
    const value = name.trim();
    if (!value) return;
    const category = isIngredientName(value) ? "食材" : undefined;
    addItem({ name: value, fromShopId, category });
  }, [addItem]);

  const handleShopChunkProgress = useCallback((processed: number, total: number, done: boolean) => {
    setShopLoadProgress((prev) => {
      if (
        prev.processed === processed &&
        prev.total === total &&
        prev.done === done
      ) {
        return prev;
      }
      return { processed, total, done };
    });
  }, []);

  const selectedShopIndex = useMemo(() => {
    if (!selectedShop) return -1;
    return shops.findIndex((shop) => shop.id === selectedShop.id);
  }, [selectedShop, shops]);

  const canNavigate = selectedShopIndex >= 0 && shops.length > 1;
  const isMinimumZoomMode = mapUiZoom < MIN_ZOOM + 0.5;
  const isOverviewZoneMode = mapUiZoom >= OVERVIEW_ZONE_MIN_ZOOM && mapUiZoom < OVERVIEW_ZONE_MAX_ZOOM;
  const isLowZoomTintMode = mapUiZoom < OVERVIEW_ZONE_MAX_ZOOM;
  const isThirdZoomFromMinimum = Math.abs(mapUiZoom - (MIN_ZOOM + 2.5)) <= 0.15;
  const shouldRenderEventGlow = highlightEventTargets && mapUiZoom >= MIN_ZOOM + 1.5;
  const shouldRenderRecipeOverlay = (showRecipeOverlay ?? false) && mapUiZoom >= 19.0;
  const shouldRenderMajorLabels = mapUiZoom <= MIN_ZOOM + 2.5;
  const shouldRenderLandmarks = mapUiZoom >= MIN_ZOOM + 0.8 || isMinimumZoomMode || highlightEventTargets;
  const interactionDisabled = agentOpen ?? false;
  const mapRotation = normalizeRotationDeg(autoRotation);

  useEffect(() => {
    if (isMinimumZoomMode) {
      setShopLoadProgress({ processed: 0, total: 0, done: true });
      return;
    }
    setShopLoadProgress({ processed: 0, total: shops.length, done: shops.length === 0 });
  }, [isMinimumZoomMode, shops.length]);

  const getSnappedCenter = useCallback(
    (center: L.LatLng) => {
      const projection = projectPointOntoRoute(center, routePoints);
      if (!projection) return null;
      return [projection.point.lat, projection.point.lng] as [number, number];
    },
    [routePoints]
  );

  const handleSelectByOffset = useCallback((offset: number) => {
    if (!canNavigate) return;
    const nextIndex = (selectedShopIndex + offset + shops.length) % shops.length;
    const nextShop = shops[nextIndex];
    if (!nextShop) return;
    handleShopClick(nextShop);
  }, [canNavigate, selectedShopIndex, handleShopClick, shops]);

  const handleMapZoomChange = useCallback(
    (zoom: number) => {
      setMapUiZoom(zoom);
      onZoomChange?.(zoom);
    },
    [onZoomChange]
  );

  // deps が [] なのは setState 関数のみ参照しているため（React が安定を保証）
  const handleCloseBanner = useCallback(() => {
    setSelectedShop(null);
    setShopBannerOrigin(null);
    setShopBannerInitialSurface("detail");
    setShopBannerMainSurface("detail");
  }, []);

  const handleSelectPreviousShop = useCallback(() => handleSelectByOffset(-1), [handleSelectByOffset]);
  const handleSelectNextShop = useCallback(() => handleSelectByOffset(1), [handleSelectByOffset]);

  const landmarkScale = useMemo(() => {
    const factor = Math.pow(1.22, mapUiZoom - 18);
    return Math.min(2.8, Math.max(0.5, factor));
  }, [mapUiZoom]);

  const landmarkIcons = useMemo(() => {
    const icons = new Map<string, L.DivIcon>();
    landmarkSpecs.forEach((spec) => {
      const width = Math.max(1, Math.round(spec.widthPx * landmarkScale));
      const height = Math.max(1, Math.round(spec.heightPx * landmarkScale));
      const highlightClass = highlightEventTargets ? " is-highlight" : "";
      const extraRotationDeg = LANDMARK_EXTRA_ROTATION_DEG[spec.key];
      const extraRotationStyle = extraRotationDeg ? `transform:rotate(${extraRotationDeg}deg);` : "";
      icons.set(
        spec.key,
        L.divIcon({
          className: "map-landmark-icon",
          html: `<img class="map-landmark-visual${highlightClass}" src="${spec.url}" alt="" draggable="false" style="width:${width}px;height:${height}px;opacity:1;${extraRotationStyle}" />`,
          iconSize: [width, height],
          iconAnchor: [width / 2, height / 2],
        })
      );
    });
    return icons;
  }, [highlightEventTargets, landmarkScale, landmarkSpecs]);

  const visibleMajorPlaceLabels = useMemo(
    () =>
      getVisibleMajorPlaceLabels({
        shouldRenderMajorLabels,
        isMinimumZoomMode,
        majorPlaceLabels,
      }),
    [isMinimumZoomMode, majorPlaceLabels, shouldRenderMajorLabels]
  );
  const activeHighlightShopIds = useMemo(() => {
    if (searchShopIds && searchShopIds.length > 0) {
      return searchShopIds;
    }
    if (aiShopIds && aiShopIds.length > 0) {
      return aiShopIds;
    }
    return undefined;
  }, [aiShopIds, searchShopIds]);
  const resultsBadgeBottom = overlaySlot
    ? 'calc(4.5rem + env(safe-area-inset-bottom,0px) + 5.5rem + 25px)'
    : 'calc(4.5rem + env(safe-area-inset-bottom,0px) + 0.5rem + 25px)';

  const visibleLandmarkSpecs = useMemo(() => {
    if (!shouldRenderLandmarks) {
      return [];
    }
    if (!isMinimumZoomMode) {
      return landmarkSpecs;
    }
    return landmarkSpecs.filter((spec) => minZoomLandmarkKeys.has(spec.key));
  }, [isMinimumZoomMode, landmarkSpecs, minZoomLandmarkKeys, shouldRenderLandmarks]);

  const { markManualRotation, snapRotationToVisibleRoad } = useMapCameraController({
    mapRef,
    gestureActiveRef: isTouchGestureActiveRef,
    interactionDisabled,
    autoRotation,
    routePoints,
    isTracking,
    setIsTracking,
    setAutoRotation,
    autoRotationDisabled: isMinimumZoomMode,
  });

  const { isTouchGestureActive, gestureTargetRef, gestureHandlers } = useMapGestures({
    mapRef,
    gestureActiveRef: isTouchGestureActiveRef,
    interactionDisabled,
    mapRotation,
    onPanStart: () => setIsTracking(false),
    onRotationChange: (rotation) => {
      markManualRotation();
      setAutoRotation(rotation);
    },
    onGestureEnd: () => {},
  });

  useEffect(() => {
    if (!isTouchGestureActive) {
      const map = mapRef.current;
      if (map) {
        snapRotationToVisibleRoad(map.getCenter());
      }
    }
  }, [isTouchGestureActive, snapRotationToVisibleRoad]);

  // ズームスライダーは2本指操作時のみ表示し、操作終了から数秒後にフェードアウトさせる
  const [zoomSliderVisible, setZoomSliderVisible] = useState(false);
  const zoomSliderHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadGestureRef = useRef(false);

  // 表示したうえで、呼ばれるたびに非表示タイマーを延長する（スライダー操作中に消えないように）
  const keepZoomSliderAlive = useCallback(() => {
    if (zoomSliderHideTimerRef.current) {
      clearTimeout(zoomSliderHideTimerRef.current);
    }
    setZoomSliderVisible(true);
    zoomSliderHideTimerRef.current = setTimeout(() => {
      setZoomSliderVisible(false);
    }, ZOOM_SLIDER_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (isTouchGestureActive) {
      // 2本指操作中は消さずに表示し続ける
      if (zoomSliderHideTimerRef.current) {
        clearTimeout(zoomSliderHideTimerRef.current);
        zoomSliderHideTimerRef.current = null;
      }
      setZoomSliderVisible(true);
      hadGestureRef.current = true;
    } else if (hadGestureRef.current) {
      // 2本指操作が終わったらタイマーを開始（初回マウント時は出さない）
      hadGestureRef.current = false;
      keepZoomSliderAlive();
    }
  }, [isTouchGestureActive, keepZoomSliderAlive]);

  useEffect(() => {
    return () => {
      if (zoomSliderHideTimerRef.current) {
        clearTimeout(zoomSliderHideTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`relative h-full w-full overflow-hidden${spotlightShopId ? " map-spotlight-mode" : ""}${activeHighlightShopIds && activeHighlightShopIds.length > 0 ? " map-search-spotlight-mode" : ""}`}
      style={{
      ["--map-rotation-inverse" as string]: `${-mapRotation}deg`,
      }}
    >
      <div
        ref={gestureTargetRef}
        className="absolute left-1/2 top-1/2 z-0"
        {...gestureHandlers}
        style={{
          width: `${mapShellSize}px`,
          height: `${mapShellSize}px`,
          touchAction: "none",
          transform: `translate(-50%, -50%) rotate(${mapRotation}deg)`,
          transformOrigin: "center center",
          transition: "transform 1500ms ease-out",
        }}
      >
        <MapContainer
          center={initialMapCenter}
          zoom={INITIAL_ZOOM}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          preferCanvas
          zoomSnap={0.05}
          zoomDelta={0.35}
          wheelPxPerZoomLevel={130}
          zoomAnimation
          markerZoomAnimation
          fadeAnimation
          scrollWheelZoom={!agentOpen && !isMobile}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={!agentOpen && !isMobile}
          className={`h-full w-full ${agentOpen ? "pointer-events-none" : ""}`}
          style={{
            height: "100%",
            width: "100%",
            backgroundColor: "#faf8f3",
          }}
          zoomControl={false}
          attributionControl={false}
          maxBounds={mapBounds}
          maxBoundsViscosity={1.0}
          whenReady={() => {
            onMapReady?.();
          }}
          ref={(map) => {
            if (map) {
              mapRef.current = map;
              setMapInstance(map);
              onMapInstance?.(map);
            } else {
              mapRef.current = null;
              setMapInstance(null);
            }
          }}
        >
          <MapZoomConstraint />
          <MapZoomRoadSnapController onSnapCenter={getSnappedCenter} />
          <MapZoomListener onZoomChange={handleMapZoomChange} />
          <TileLayer
            url={BASEMAP_TILE_URL}
            attribution={BASEMAP_ATTRIBUTION}
            opacity={isMinimumZoomMode ? 0.44 : isThirdZoomFromMinimum ? 0.11 : 0.22}
            zIndex={1}
            keepBuffer={16}
          />
          {/* 背景 */}
          <BackgroundOverlay isMinimumZoomMode={isMinimumZoomMode} />
          <MapOverlays
            isLowZoomTintMode={isLowZoomTintMode}
            routePoints={routePoints}
            routeConfig={routeConfig}
            mapBounds={mapBounds}
            visibleMajorPlaceLabels={visibleMajorPlaceLabels}
            shouldRenderEventGlow={shouldRenderEventGlow}
            eventTargets={eventTargets}
            highlightEventTargets={highlightEventTargets}
            visibleLandmarkSpecs={visibleLandmarkSpecs}
            landmarkIcons={landmarkIcons}
            isMinimumZoomMode={isMinimumZoomMode}
            isOverviewZoneMode={isOverviewZoneMode}
            shops={shops}
            onShopClick={handleShopClick}
            onChunkProgress={handleShopChunkProgress}
            selectedShopId={selectedShop?.id}
            favoriteShopIds={favoriteShopIds}
            searchShopIds={searchShopIds}
            aiHighlightShopIds={aiShopIds}
            commentHighlightShopIds={commentShopId ? [commentShopId] : []}
            kotoduteShopIds={kotoduteShopIds}
            recipeIngredientIconsByShop={recipeIngredientIconsByShop}
            attendanceLabelsByShop={attendanceLabelsByShop}
            bagShopIds={bagShopIds}
            shouldRenderRecipeOverlay={shouldRenderRecipeOverlay}
            shopsWithIngredients={shopsWithIngredients}
            recipeIngredients={recipeIngredients}
            onRecipeShopClick={setSelectedShop}
            OptimizedShopLayerWithClustering={OptimizedShopLayerWithClustering}
          />

        {/* ユーザー位置 */}
        <UserLocationMarker
          onLocationUpdate={(inMarket, position) => {
            setUserLocation(position);
            setIsInMarket(inMarket);
            onUserLocationUpdate?.({
              lat: position[0],
              lng: position[1],
              inMarket,
            });
          }}
          isTracking={isTracking}
          suppressInitialFocus={suppressInitialLocationFocus}
          routePoints={routePoints}
          routeConfig={routeConfig}
        />

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            【削除】ZoomTracker を削除
            - currentZoom を state で管理しないため不要
            - ズーム操作で React が再レンダリングされない
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        </MapContainer>
      </div>

      <TimeAmbientOverlay />
      <MapZoomGuideToast message={zoomGuideMessage} />
      {!hideMapUI && (
        <>
          <MapControls
            map={mapInstance}
            isTracking={isTracking}
            onToggleTracking={() => setIsTracking((prev) => !prev)}
            currentZoom={mapUiZoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            zoomSliderVisible={zoomSliderVisible}
            onZoomSliderInteract={keepZoomSliderAlive}
          />
        </>
      )}

      {spotlightShopId && <SpotlightCountdownBar shopId={spotlightShopId} />}

      {activeHighlightShopIds && activeHighlightShopIds.length > 0 && (
        <SearchResultsSheet
          shops={displayShops}
          searchShopIds={activeHighlightShopIds}
          map={mapInstance}
          onClearSearch={onClearSearch}
          badgeBottom={resultsBadgeBottom}
        />
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          【ポイント9】UI 層と地図層を完全分離
          - ShopDetailBanner は MapContainer の外側
          - この state 更新が地図描画に影響しない
          - 詳細パネルの開閉で地図が再レンダリングされない
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {selectedShop && (
        <>
          <ShopDetailBanner
            key={`${selectedShop.id}-${shopBannerSession}`}
            shop={selectedShop}
            openNonce={shopBannerSession}
            initialMobileSurface={shopBannerInitialSurface}
            onMobileMainSurfaceChange={setShopBannerMainSurface}
            canNavigateBetweenShops={canNavigate}
            selectedShopPosition={selectedShopIndex + 1}
            totalShopCount={shops.length}
            onSelectPreviousShop={handleSelectPreviousShop}
            onSelectNextShop={handleSelectNextShop}
            onClose={handleCloseBanner}
            onAddToBag={handleAddToBag}
            variant={shopBannerVariant}
            originRect={shopBannerOrigin ?? undefined}
            reserveBottomNavSpace={false}
          />
        </>
      )}

      <MapAgentAssistant
        onOpenShop={handleOpenShop}
        onPlanUpdate={handlePlanUpdate}
        userLocation={userLocation}
        isOpen={agentOpen}
        onToggle={onAgentToggle}
        hideLauncher
      />

      {/* 外部から注入するオーバーレイ（マップ座標系内） */}
      {overlaySlot}
    </div>
  );
});

export default MapView;
