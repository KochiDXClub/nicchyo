"use client";

import NavigationBar from "../../components/NavigationBar";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import SearchClient from "../search/SearchClient";
import type { Map as LeafletMap } from "leaflet";
import { pickDailyRecipe, recipes, type Recipe } from "../../../lib/recipes";
import { clearSearchMapPayload, loadAiMapPayload, loadSearchMapPayload } from "../../../lib/searchMapStorage";
import NextImage from "next/image";
import { getShopBannerImage } from "../../../lib/shopImages";
const _GrandmaChatter = dynamic(() => import("./components/GrandmaChatter"), { ssr: false });
import { useTimeBadge } from "./hooks/useTimeBadge";
import { BadgeModal as _BadgeModal } from "./components/BadgeModal";
import { useAuth } from "../../../lib/auth/AuthContext";
import { SHOP_CATEGORY_NAMES } from "./data/shops";
import type { Shop } from "./data/shops";
import type { Landmark } from "./types/landmark";
import type { MapRoute } from "./types/mapRoute";
import { loadKotodute } from "../../../lib/kotoduteStorage";
import { useMapLoading } from "../../components/MapLoadingProvider";
import { grandmaEvents } from "./data/grandmaEvents";
import { recordMarketEnter, recordMarketExit } from "../../../lib/storage/marketStats";
import { buildSearchIndex } from "../search/lib/searchIndex";
import { useShopSearch } from "../search/hooks/useShopSearch";
import { getOrCreateConsultVisitorKey } from "../../../lib/consultVisitorKey";
import MapCharacterConsult from "./components/MapCharacterConsult";
import NearbyExploreButton from "./components/NearbyExploreButton";
import NearbyExplorePanel, {
  type NearbyRecommendedShop,
} from "./components/NearbyExplorePanel";
import { useNearbyPromptVisibility } from "./hooks/useNearbyPromptVisibility";
import {
  buildNearbyNote,
  isPointInRotatedRect,
  parseCssRotationRad,
  summarizeNearbyShops,
  type NearbyViewportSummary,
} from "./utils/viewportSummary";
import {
  deriveInterestCategories,
  selectNearbyRecommendations,
} from "./utils/nearbyRecommendations";
import { loadFavoriteShopIds } from "../../../lib/favoriteShops";
import { useBag } from "../../../lib/storage/BagContext";
import {
  OVERVIEW_ZONE_MIN_ZOOM,
  OVERVIEW_ZONE_MAX_ZOOM,
} from "./config/displayConfig";

const MapView = dynamic(() => import("./components/MapView"), {
  ssr: false,
});

type MapPageClientProps = {
  shops: Shop[];
  landmarks: Landmark[];
  mapRoute: MapRoute;
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
};


// モバイル（375px基準）でチップ3件が収まり、残りは折りたたむUX判断
const GENRE_PREVIEW_COUNT = 3;

// 「このへん、なにがある？」の対象範囲＝画面に見えているマップの80%の長方形
const NEARBY_AREA_RATIO = 0.8;

function GenreFilter({
  categories,
  selected,
  onSelect,
}: {
  categories: readonly string[];
  selected: string | null;
  onSelect: (cat: string) => void;
}) {
  const isSelectedHidden = selected !== null && categories.indexOf(selected) >= GENRE_PREVIEW_COUNT;
  const [expanded, setExpanded] = useState(isSelectedHidden);

  useEffect(() => {
    if (isSelectedHidden) setExpanded(true);
  }, [isSelectedHidden]);

  const previewCategories = categories.slice(0, GENRE_PREVIEW_COUNT);
  const hiddenCategories = categories.slice(GENRE_PREVIEW_COUNT);

  function chipClass(cat: string) {
    return `shrink-0 whitespace-nowrap rounded-chip border px-[13px] py-[7px] text-[13px] font-bold shadow-chip transition-all duration-[120ms] ${
      selected === cat
        ? 'border-amber-600 bg-amber-500 text-white'
        : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50 active:bg-amber-50'
    }`;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {previewCategories.map((cat) => (
        <motion.button key={cat} type="button" onClick={() => onSelect(cat)} className={chipClass(cat)} whileTap={{ scale: 0.88 }}>
          {cat}
        </motion.button>
      ))}

      {/* 展開中の追加チップ（アニメ付き） */}
      <AnimatePresence initial={false}>
        {expanded && hiddenCategories.map((cat, i) => (
          <motion.button
            key={cat}
            type="button"
            onClick={() => onSelect(cat)}
            className={chipClass(cat)}
            initial={{ opacity: 0, scale: 0.82, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.82, y: -4 }}
            transition={{ duration: 0.18, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] }}
          >
            {cat}
          </motion.button>
        ))}
      </AnimatePresence>

      {/* ＋ / × トグルボタン（チップと同列・オレンジ） */}
      <motion.button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? 'ジャンルを閉じる' : 'ジャンルをもっと見る'}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-md active:scale-90"
        animate={{ rotate: expanded ? 45 : 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        whileTap={{ scale: 0.88 }}
      >
        <svg width="13" height="13" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </motion.button>
    </div>
  );
}

export default function MapPageClient({
  shops,
  landmarks,
  mapRoute,
  shopBannerVariant = "default",
  attendanceEstimates,
}: MapPageClientProps) {
  const showGrandma = false;
  const searchParams = useSearchParams();
  const router = useRouter();
  const activePanel = searchParams?.get("panel") === "search" ? "search" : null;
  const { user, permissions } = useAuth();
  const { markMapReady } = useMapLoading();
  const { items: bagItems } = useBag();
  const initialShopIdParam = searchParams?.get("shop");
  const isAiFocusMode = searchParams?.get("ai") === "1";
  const searchParamsKey = searchParams?.toString() ?? "";
  const initialShopId = initialShopIdParam ? Number(initialShopIdParam) : undefined;
  const [recommendedRecipe, setRecommendedRecipe] = useState<Recipe | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [showRecipeOverlay, setShowRecipeOverlay] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const { priority: _priority, clearPriority: _clearPriority } = useTimeBadge();
  const [_showBadgeModal, _setShowBadgeModal] = useState(false);
  const [showVendorPrompt, setShowVendorPrompt] = useState(false);
  const [vendorShopName, setVendorShopName] = useState<string | null>(null);
  const [_isHoldActive, _setIsHoldActive] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [eventMessageIndex, setEventMessageIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [isInMarket, setIsInMarket] = useState<boolean | null>(null);
  useEffect(() => {
    if (isInMarket === true) recordMarketEnter();
    else if (isInMarket === false) recordMarketExit();
  }, [isInMarket]);
  // スポットライトモード用（タップ時のみ、2秒で自動解除）
  const [spotlightShopId, setSpotlightShopId] = useState<number | null>(null);
  const spotlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activateSpotlight = useCallback((shopId: number) => {
    if (spotlightTimerRef.current) clearTimeout(spotlightTimerRef.current);
    setSpotlightShopId(shopId);
    spotlightTimerRef.current = setTimeout(() => {
      setSpotlightShopId(null);
      spotlightTimerRef.current = null;
    }, 2000);
  }, []);
  const [isShopBannerOpen, setIsShopBannerOpen] = useState(false);
  const [trackingButtonTop, setTrackingButtonTop] = useState(112); // 112px = top-28 (7rem) — Tailwind デフォルト基準値
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const searchAreaRef = useCallback((el: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setTrackingButtonTop(rect.bottom + 8);
    });
    observer.observe(el);
    resizeObserverRef.current = observer;
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const updateBannerState = () => {
      setIsShopBannerOpen(document.body.classList.contains("shop-banner-open"));
    };
    updateBannerState();
    const observer = new MutationObserver(updateBannerState);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const dragControls = useDragControls();
  const [mapCharacterConsultActive, setMapCharacterConsultActive] = useState(false);
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const introFocusTimerRef = useRef<number | null>(null);
  const [searchMarkerPayload, setSearchMarkerPayload] = useState<{
    ids: number[];
    label: string;
  } | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState(
    () => searchParams?.get("q") ?? '',
  );
  const [mapSearchCategory, setMapSearchCategory] = useState<string | null>(null);
  const mapSearchIndex = useMemo(() => buildSearchIndex(shops), [shops]);
  const mapSearchResults = useShopSearch({
    shops,
    searchIndex: mapSearchIndex,
    textQuery: mapSearchQuery,
    category: mapSearchCategory,
    chome: null,
  });
  const mapSearchShopIds = useMemo(
    () =>
      mapSearchQuery.trim() || mapSearchCategory
        ? mapSearchResults.map((s) => s.id)
        : undefined,
    [mapSearchCategory, mapSearchQuery, mapSearchResults],
  );
  const [aiMarkerPayload, setAiMarkerPayload] = useState<{
    ids: number[];
    label: string;
  } | null>(null);
  // 「このへん、なにがある？」：開いているパネルの内容と、AI相談への引き継ぎ質問
  const [nearbyState, setNearbyState] = useState<{
    summary: NearbyViewportSummary;
    center: { lat: number; lng: number };
    recommendations: NearbyRecommendedShop[];
    note: string;
  } | null>(null);
  const [nearbyConsultSeed, setNearbyConsultSeed] = useState<{
    question: string;
    location: { lat: number; lng: number };
  } | null>(null);
  const clearMapSearchState = useCallback(() => {
    clearSearchMapPayload();
    setSearchMarkerPayload(null);
    setMapSearchQuery('');
    setMapSearchCategory(null);
  }, []);
  const closeMapCharacterConsult = useCallback(() => {
    setMapCharacterConsultActive(false);
    setAiMarkerPayload(null);
    setNearbyConsultSeed(null);
  }, []);
  const startMapCharacterConsult = useCallback(() => {
    // Open consult page instead of inline map-native consult by default
    clearMapSearchState();
    setNearbyState(null);
    setMapCharacterConsultActive(false);
    router.push('/consult');
  }, [clearMapSearchState, router]);
  const closeMapInteractionMode = useCallback(() => {
    clearMapSearchState();
    closeMapCharacterConsult();
    setNearbyState(null);
    router.push('/map');
  }, [clearMapSearchState, closeMapCharacterConsult, router]);

  // 旧 URL 互換: /map?panel=consult が来ても直接 AI 相談モードを起動する
  useEffect(() => {
    if (searchParams?.get("panel") === "consult") {
      startMapCharacterConsult();
      return;
    }
    if (activePanel === 'search') {
      closeMapCharacterConsult();
    }
  }, [activePanel, closeMapCharacterConsult, searchParams, startMapCharacterConsult]);

  const vendorShopId = user?.vendorId ?? null;
  const activeEvent = useMemo(() => {
    if (!showGrandma) return null;
    return grandmaEvents.find((event) => event.id === activeEventId) ?? null;
  }, [activeEventId, showGrandma]);
  const aiImageTargets = useMemo(() => {
    return grandmaEvents
      .map((event) => {
        const image = event.messages.find((message) => message.image)?.image;
        if (!image) return null;
        return { image, location: event.location };
      })
      .filter(Boolean) as Array<{
      image: string;
      location: { lat: number; lng: number; radiusMeters: number };
    }>;
  }, []);
  const shopById = useMemo(() => {
    const map = new Map<number, Shop>();
    shops.forEach((shop) => map.set(shop.id, shop));
    return map;
  }, [shops]);

  const prefetchShopImage = useCallback(
    (shopId: number) => {
      if (typeof window === "undefined") return;
      const shop = shopById.get(shopId);
      if (!shop) return;
      const bannerSeed = shop.position ?? shop.id;
      const src = shop.images?.main ?? getShopBannerImage(shop.category, bannerSeed);
      if (!src) return;
      const img = new Image();
      img.src = src;
    },
    [shopById]
  );
  const _activeMessage = activeEvent?.messages[eventMessageIndex] ?? null;
  const _eventTargets = useMemo(() => {
    if (!showGrandma) return [];
    return grandmaEvents.map((event) => ({
      id: event.id,
      lat: event.location.lat,
      lng: event.location.lng,
    }));
  }, [showGrandma]);
  const handleMapInstance = useCallback((map: LeafletMap) => {
    mapRef.current = map;
    setMapInstance(map);
  }, []);

  const vendorShop = useMemo(() => {
    if (!vendorShopId) return null;
    return shops.find((shop) => shop.vendorId === vendorShopId) ?? null;
  }, [shops, vendorShopId]);

  useEffect(() => {
    const dismissed = typeof window !== "undefined" && localStorage.getItem("nicchyo-daily-recipe-dismissed");
    const todayId = typeof window !== "undefined" && localStorage.getItem("nicchyo-daily-recipe-id");
    const daily = pickDailyRecipe();
    if (!todayId) {
      localStorage.setItem("nicchyo-daily-recipe-id", daily.id);
    }
    if (!dismissed) {
      setRecommendedRecipe(daily);
      // setShowBanner(true);
    } else if (todayId) {
      const match = pickDailyRecipe();
      setRecommendedRecipe(match);
    }
  }, []);

  useEffect(() => {
    if (!searchParams) return;
    const recipeId = searchParams.get("recipe");
    if (!recipeId) return;
    const match = recipes.find((recipe) => recipe.id === recipeId);
    if (!match) return;
    setRecommendedRecipe(match);
    setShowRecipeOverlay(true);
  }, [searchParams, searchParamsKey]);

  useEffect(() => {
    if (!searchParams) return;
    const enabled = searchParams.get("search");
    if (!enabled) {
      setSearchMarkerPayload(null);
      return;
    }
    const labelParam = searchParams.get("label") ?? "";
    const payload = loadSearchMapPayload();
    if (payload) {
      setSearchMarkerPayload(payload);
    } else if (labelParam) {
      setSearchMarkerPayload({ ids: [], label: labelParam });
    }
  }, [searchParams, searchParamsKey]);

  useEffect(() => {
    if (!searchParams) return;
    const enabled = searchParams.get("ai");
    if (!enabled) {
      setAiMarkerPayload(null);
      return;
    }
    const labelParam = searchParams.get("label") ?? "AIおすすめ";
    const payload = loadAiMapPayload();
    if (payload) {
      setAiMarkerPayload(payload);
    } else {
      setAiMarkerPayload({ ids: [], label: labelParam });
    }
  }, [searchParams, searchParamsKey]);

  // When opening map with ?walkPlan=1, try to load a previously generated walk plan
  useEffect(() => {
    if (!searchParams) return;
    const enabled = searchParams.get('walkPlan');
    if (!enabled) return;
    try {
      const raw = localStorage.getItem('nicchyo-walk-plan');
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        title?: string;
        shops?: Array<{ id?: number }>;
      } | null;
      if (!parsed || !Array.isArray(parsed.shops)) return;
      // id: 0 は実店舗に突合できなかった立ち寄り（マップでは表示できない）
      const ids = parsed.shops
        .map((shop) => Number(shop?.id))
        .filter((id) => Number.isInteger(id) && id > 0);
      if (ids.length > 0) {
        setAiMarkerPayload({ ids, label: parsed.title ?? 'おさんぽプラン' });
      }
    } catch {
      // ignore
    }
  }, [searchParams]);

  useEffect(() => {
    if (!permissions.isVendor || !vendorShopId) return;
    if (!vendorShop) return;
    const key = `nicchyo-vendor-prompt-${vendorShopId}`;
    const already = typeof window !== "undefined" && localStorage.getItem(key);
    if (already) return;
    setVendorShopName(vendorShop.name);
    setShowVendorPrompt(true);
    localStorage.setItem(key, "dismissed");
  }, [permissions.isVendor, vendorShopId, vendorShop]);

  const handleAcceptRecipe = () => {
    setShowRecipeOverlay(true);
    setShowBanner(false);
    localStorage.setItem("nicchyo-daily-recipe-dismissed", "false");
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem("nicchyo-daily-recipe-dismissed", "true");
  };

  const handleOpenVendorBanner = () => {
    if (!vendorShop) return;
    router.push(`/map?shop=${vendorShop.id}`);
    setShowVendorPrompt(false);
  };

  const _handleGrandmaDrop = useCallback(
    (position: { x: number; y: number }) => {
      if (!showGrandma) return;
      if (!mapRef.current) return;
      const container = mapRef.current.getContainer();
      const rect = container.getBoundingClientRect();
      const point: [number, number] = [
        position.x - rect.left,
        position.y - rect.top,
      ];
      const latlng = mapRef.current.containerPointToLatLng(point);
      const hit = grandmaEvents.find((event) => {
        const target = { lat: event.location.lat, lng: event.location.lng };
        const dist = mapRef.current?.distance(latlng, target) ?? Infinity;
        return dist <= event.location.radiusMeters;
      });
      if (!hit) return;
      setActiveEventId(hit.id);
      setEventMessageIndex(0);
    },
    [showGrandma]
  );

  const _handleEventAdvance = () => {
    if (!activeEvent) return;
    if (eventMessageIndex < activeEvent.messages.length - 1) {
      setEventMessageIndex((prev) => prev + 1);
    } else {
      setActiveEventId(null);
      setEventMessageIndex(0);
    }
  };

  const _handleEventBack = () => {
    if (!activeEvent) return;
    if (eventMessageIndex > 0) {
      setEventMessageIndex((prev) => prev - 1);
    }
  };

  const _handleGrandmaAsk = useCallback(async (
    text: string,
    imageFile?: File | null,
    context?: { shopId?: number; shopName?: string; source?: "suggestion" | "input" },
    _history?: Array<{ role: "user" | "assistant"; text: string }>,
    _memorySummary?: string
  ) => {
    try {
      const visitorKey = getOrCreateConsultVisitorKey();
      const useForm = !!imageFile;
      const body = useForm
        ? (() => {
            const form = new FormData();
            form.append("text", text);
            form.append("location", JSON.stringify(userLocation ?? null));
            if (context?.shopId) form.append("shopId", String(context.shopId));
            if (context?.shopName) form.append("shopName", context.shopName);
            if (visitorKey) form.append("visitorKey", visitorKey);
            if (imageFile) form.append("image", imageFile);
            return form;
          })()
        : JSON.stringify({
            text,
            location: userLocation,
            shopId: context?.shopId ?? null,
            shopName: context?.shopName ?? null,
            visitorKey,
          });
      const response = await fetch("/api/grandma/ask", {
        method: "POST",
        headers: useForm ? undefined : { "Content-Type": "application/json" },
        body,
      });
      const payload = (await response.json()) as {
        reply?: string;
        imageUrl?: string;
        shopIds?: number[];
        errorMessage?: string;
      };
      if (!response.ok) {
        return {
          reply:
            payload.reply ??
            payload.errorMessage ??
            "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
        };
      }
      const rawReply =
        payload.reply ?? "ごめんね、今は答えを出せんかった。時間をおいて試してね。";
      if (payload.shopIds && payload.shopIds.length > 0) {
        setAiMarkerPayload({ ids: payload.shopIds, label: "AIおすすめ" });
        const cleaned = rawReply.replace(/SHOP_IDS:\s*([0-9,\s]+)/i, "").trim();
        return {
          reply: cleaned || "おすすめのお店を表示したよ。",
          imageUrl: payload.imageUrl,
          shopIds: payload.shopIds,
        };
      }
      setAiMarkerPayload(null);
      return { reply: rawReply, imageUrl: payload.imageUrl };
    } catch {
      return {
        reply: "ごめんね、今は答えを出せんかった。時間をおいて試してね。",
      };
    }
  }, [userLocation]);

  const handleCommentShopFocus = useCallback(
    (shopId: number) => {
      const map = mapRef.current;
      const shop = shopById.get(shopId);
      if (!map || !shop) return;
      prefetchShopImage(shopId);
      activateSpotlight(shopId);
      const maxZoom = map.getMaxZoom() ?? 19;
      map.flyTo([shop.lat, shop.lng], maxZoom, {
        animate: true,
        duration: 0.8,
        easeLinearity: 0.25,
      });
    },
    [activateSpotlight, prefetchShopImage, shopById]
  );

  const handleCommentShopOpen = useCallback(
    (shopId: number) => {
      handleCommentShopFocus(shopId);
      if (introFocusTimerRef.current !== null) {
        window.clearTimeout(introFocusTimerRef.current);
        introFocusTimerRef.current = null;
      }
      if (typeof document !== "undefined") {
        document.body.classList.add("shop-banner-open");
      }
      introFocusTimerRef.current = window.setTimeout(() => {
        router.push(`/map?shop=${shopId}`);
        introFocusTimerRef.current = null;
      }, 900);
    },
    [handleCommentShopFocus, router]
  );
  const _handleAiImageClick = useCallback(
    (imageUrl: string) => {
      const target = aiImageTargets.find((entry) => entry.image === imageUrl);
      if (!target || !mapRef.current) return;
      const maxZoom = mapRef.current.getMaxZoom() ?? 19;
      mapRef.current.flyTo([target.location.lat, target.location.lng], maxZoom, {
        animate: true,
        duration: 0.8,
        easeLinearity: 0.25,
      });
    },
    [aiImageTargets]
  );

  useEffect(() => {
    if (initialShopId) {
      prefetchShopImage(initialShopId);
    }
    return () => {
      if (introFocusTimerRef.current !== null) {
        window.clearTimeout(introFocusTimerRef.current);
      }
    };
  }, [initialShopId, prefetchShopImage]);

  const hasSearchMode =
    activePanel === 'search' ||
    !!searchMarkerPayload ||
    !!mapSearchQuery.trim() ||
    !!mapSearchCategory ||
    !!mapSearchShopIds?.length;
  const hasAiMode =
    mapCharacterConsultActive ||
    !!aiMarkerPayload;

  const kotoduteShopIds = useMemo(() => {
    const notes = loadKotodute();
    const ids = new Set<number>();
    notes.forEach((note) => {
      if (typeof note.shopId === "number") {
        ids.add(note.shopId);
      }
    });
    return Array.from(ids);
  }, []);

  // ── 「このへん、なにがある？」──────────────────────
  // 他のモード（検索・AI相談・店舗バナー・パネル表示中）ではボタンを出さない
  const nearbySuppressed =
    !!nearbyState || hasSearchMode || hasAiMode || isShopBannerOpen;
  // 回転のみのジェスチャーは Leaflet の move/zoom を発火させないため、
  // MapView から素通しで受け取ってボタンの静止判定に反映する
  const [isMapGestureActive, setIsMapGestureActive] = useState(false);
  const nearbyButtonVisible = useNearbyPromptVisibility({
    map: mapInstance,
    suppressed: nearbySuppressed,
    minZoom: OVERVIEW_ZONE_MIN_ZOOM,
    maxZoom: OVERVIEW_ZONE_MAX_ZOOM,
    isGestureActive: isMapGestureActive,
  });

  const openNearbyPanel = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    // マップコンテナは画面より大きい回転シェルいっぱいに広がっているため、
    // 「画面に見えているマップ領域」はシェルの親要素からサイズを取り、
    // シェルの CSS 回転角を打ち消して画面中央80%の長方形で店舗を判定する
    const container = map.getContainer();
    const shell = container.parentElement;
    const viewportEl = shell?.parentElement;
    if (!shell || !viewportEl) return;
    const rect = {
      center: { x: container.clientWidth / 2, y: container.clientHeight / 2 },
      halfWidth: (viewportEl.clientWidth * NEARBY_AREA_RATIO) / 2,
      halfHeight: (viewportEl.clientHeight * NEARBY_AREA_RATIO) / 2,
      rotationRad: parseCssRotationRad(getComputedStyle(shell).transform),
    };
    const center = map.getCenter();
    const summary = summarizeNearbyShops(
      shops,
      { lat: center.lat, lng: center.lng },
      (point) =>
        isPointInRotatedRect(
          map.latLngToContainerPoint([point.lat, point.lng]),
          rect
        )
    );
    // おすすめ: 行動シグナル（お気に入り・買い物リスト・ことづて）から
    // 興味ジャンルを導き、範囲内の店舗（近い順）から9店を選ぶ
    const inAreaShops = summary.shopIds
      .map((id) => shopById.get(id))
      .filter((shop): shop is Shop => !!shop);
    const favoriteIds = new Set(loadFavoriteShopIds());
    const bagShopIds = bagItems
      .map((item) => item.fromShopId)
      .filter((id): id is number => typeof id === "number");
    const interestCategories = deriveInterestCategories(
      [...favoriteIds, ...bagShopIds, ...kotoduteShopIds],
      (id) => shopById.get(id)?.category
    );
    const recommendations: NearbyRecommendedShop[] = selectNearbyRecommendations(
      inAreaShops,
      { favoriteShopIds: favoriteIds, interestCategories, limit: 9 }
    ).map(({ shop, reason }) => ({
      shopId: shop.id,
      name: shop.name,
      category: shop.category,
      imageUrl:
        shop.images?.main ??
        getShopBannerImage(shop.category, shop.position ?? shop.id),
      reason,
    }));
    setNearbyState({
      summary,
      center: { lat: center.lat, lng: center.lng },
      recommendations,
      note: buildNearbyNote(summary),
    });
  }, [bagItems, kotoduteShopIds, shopById, shops]);

  const closeNearbyPanel = useCallback(() => {
    setNearbyState(null);
  }, []);

  const handleNearbyAsk = useCallback(
    (question: string) => {
      const center = nearbyState?.center;
      if (!center) return;
      setNearbyConsultSeed({ question, location: center });
      startMapCharacterConsult();
    },
    [nearbyState, startMapCharacterConsult]
  );

  // パネル表示中にマップが動いたら閉じる（オレンジ枠は画面固定のため、
  // 移動すると要約と実際の範囲がズレてしまう）
  useEffect(() => {
    if (!nearbyState || !mapInstance) return;
    const close = () => setNearbyState(null);
    mapInstance.on('move', close);
    mapInstance.on('zoom', close);
    return () => {
      mapInstance.off('move', close);
      mapInstance.off('zoom', close);
    };
  }, [nearbyState, mapInstance]);

  const shouldShowNavigationBar = !isShopBannerOpen;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      {/* 背景デコレーション */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30 z-0">
        <div className="absolute -top-20 -left-20 w-60 h-60 bg-gradient-to-br from-amber-200 to-orange-200 rounded-full blur-3xl opacity-20"></div>
        <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-gradient-to-tl from-yellow-200 to-amber-200 rounded-full blur-3xl opacity-20"></div>
      </div>

      {/* メイン: NavigationBar(h-14=3.5rem) + safe-area-inset-bottom 分だけ下に余白 */}
      <main
        className="relative z-10 flex-1 overflow-hidden"
        style={{
          paddingBottom: shouldShowNavigationBar
            ? 'calc(3.5rem + var(--safe-bottom, 0px))'
            : '0px',
        }}
      >
        <div className="relative h-full overflow-hidden">
            {showBanner && recommendedRecipe && (
              <div className="absolute left-4 right-4 top-4 z-[1200]">
                <div className="rounded-2xl border border-amber-200 bg-white/95 shadow-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                        本日のおすすめレシピ
                      </p>
                      <h2 className="text-lg font-bold text-gray-900">{recommendedRecipe.title}</h2>
                      <p className="text-xs text-gray-700">{recommendedRecipe.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDismissBanner}
                      className="h-8 w-8 rounded-full border border-amber-200 bg-white text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-50"
                      aria-label="閉じる"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    {recommendedRecipe.ingredients.map((ing) => (
                      <span
                        key={ing.id}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-100 bg-amber-50 px-2 py-1 font-semibold text-amber-800"
                      >
                        <span aria-hidden>🥕</span>
                        {ing.name}
                        {ing.seasonal ? " (旬)" : ""}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                    <button
                      type="button"
                      onClick={handleAcceptRecipe}
                      className="w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-200/70 transition hover:bg-amber-500"
                    >
                      このレシピを見る
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push("/recipes")}
                      className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                    >
                      ほかのレシピを探す
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showVendorPrompt && vendorShopName && (
              <div className="absolute left-4 right-4 top-1/2 z-[1300] -translate-y-1/2">
                <div className="rounded-2xl border border-amber-200 bg-white/95 p-4 shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                        出店者向け
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {vendorShopName} のショップバナーを開きますか？
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowVendorPrompt(false)}
                      className="h-8 w-8 rounded-full border border-amber-200 bg-white text-xs font-bold text-amber-700 shadow-sm hover:bg-amber-50"
                      aria-label="閉じる"
                    >
                      ×
                    </button>
                  </div>
                  {(vendorShop?.images?.main ||
                    getShopBannerImage(
                      vendorShop?.category,
                      (vendorShop?.position ?? vendorShop?.id ?? 0)
                    )) && (
                    <div className="mt-3 overflow-hidden rounded-2xl border border-amber-100 bg-white">
                      <NextImage
                        src={
                          vendorShop?.images?.main ??
                          getShopBannerImage(
                            vendorShop?.category,
                            (vendorShop?.position ?? vendorShop?.id ?? 0)
                          ) ?? ''
                        }
                        alt={`${vendorShopName}の写真`}
                        width={600}
                        height={160}
                        className="h-40 w-full object-cover object-center"
                      />

                    </div>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                    <button
                      type="button"
                      onClick={handleOpenVendorBanner}
                      className="w-full rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-200/70 transition hover:bg-amber-500"
                    >
                        お店の情報を開く
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVendorPrompt(false)}
                      className="w-full rounded-xl border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-50"
                    >
                      後で
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 全幅検索バー + ジャンルフィルター（AI相談・このへんモード時は非表示） */}
            {!mapCharacterConsultActive && !nearbyState && (
              <div
                ref={searchAreaRef}
                className="absolute left-3 right-3 top-3 z-[1001] flex flex-col gap-2"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {/* 検索バー */}
                <div className={`flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg ring-1 backdrop-blur-sm transition-all duration-200 ${
                  mapSearchQuery.trim() || mapSearchCategory
                    ? 'bg-gradient-to-r from-amber-100/95 to-orange-50/95 ring-amber-400/50'
                    : 'bg-white/90 ring-slate-900/8'
                }`}>
                  <svg className="w-4 h-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                    <circle cx="11" cy="11" r="6.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 16.5 20 20" />
                  </svg>
                  <input
                    type="text"
                    placeholder="お店を検索…"
                    value={mapSearchQuery}
                    onChange={(e) => setMapSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  {(mapSearchQuery.trim() || mapSearchCategory) && (
                    <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {mapSearchResults.length}件
                    </span>
                  )}
                  {(mapSearchQuery || mapSearchCategory) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapSearchQuery('');
                        setMapSearchCategory(null);
                      }}
                      className="shrink-0 rounded-full bg-slate-100 p-1.5 text-slate-500 hover:bg-slate-200 transition-colors"
                      aria-label="検索をクリア"
                    >
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    </button>
                  )}
                </div>

                {/* ジャンルフィルター */}
                <GenreFilter
                  categories={SHOP_CATEGORY_NAMES}
                  selected={mapSearchCategory}
                  onSelect={(cat) => setMapSearchCategory(mapSearchCategory === cat ? null : cat)}
                />
              </div>
            )}

            <MapView
              shops={shops}
              landmarks={landmarks}
              mapRoute={mapRoute}
              initialShopId={initialShopId}
              openInitialShopBanner={!isAiFocusMode}
              selectedRecipe={recommendedRecipe ?? undefined}
              showRecipeOverlay={showRecipeOverlay}
              onCloseRecipeOverlay={() => setShowRecipeOverlay(false)}
              agentOpen={agentOpen}
              onAgentToggle={setAgentOpen}
              searchShopIds={searchMarkerPayload?.ids ?? mapSearchShopIds}
              aiShopIds={aiMarkerPayload?.ids}
              onMapReady={markMapReady}
              onMapInstance={handleMapInstance}
              onUserLocationUpdate={(coords) => {
                setUserLocation({ lat: coords.lat, lng: coords.lng });
                setIsInMarket(coords.inMarket);
              }}
              spotlightShopId={spotlightShopId ?? undefined}
              onClearSearch={() => {
                clearSearchMapPayload();
                setSearchMarkerPayload(null);
                setMapSearchQuery('');
                setMapSearchCategory(null);
                setAiMarkerPayload(null);
              }}
              kotoduteShopIds={kotoduteShopIds}
              shopBannerVariant={shopBannerVariant}
              attendanceEstimates={attendanceEstimates}
              suppressInitialLocationFocus={isAiFocusMode}
              hideMapUI={mapCharacterConsultActive || !!nearbyState}
              trackingButtonTop={trackingButtonTop}
              onGestureActiveChange={setIsMapGestureActive}
              overlaySlot={
                mapCharacterConsultActive ? (
                  <MapCharacterConsult
                    map={mapInstance}
                    shops={shops}
                    onShopsRecommended={(shopIds) => {
                      setAiMarkerPayload({ ids: shopIds, label: 'AIおすすめ' });
                    }}
                    initialQuestion={nearbyConsultSeed?.question}
                    initialLocation={nearbyConsultSeed?.location ?? null}
                  />
                ) : nearbyState ? (
                  <NearbyExplorePanel
                    summary={nearbyState.summary}
                    recommendations={nearbyState.recommendations}
                    note={nearbyState.note}
                    onSelectShop={handleCommentShopOpen}
                    onAsk={handleNearbyAsk}
                    onClose={closeNearbyPanel}
                  />
                ) : undefined
              }
            />

            {/* 「このへん」の対象範囲（画面中央80%）を示すオレンジ枠。
                ボタンと同時にフェードで浮き出て、パネル表示中も残る */}
            <div
              className={`pointer-events-none absolute left-1/2 top-1/2 z-[1140] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border-4 border-orange-400/80 bg-orange-300/10 transition-opacity duration-500 ease-out ${
                nearbyButtonVisible || nearbyState ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                width: `${NEARBY_AREA_RATIO * 100}%`,
                height: `${NEARBY_AREA_RATIO * 100}%`,
              }}
              aria-hidden
            />

            {/* 「このへん、なにがある？」ボタン（対象ズーム帯で静止時にフェード表示） */}
            {!mapCharacterConsultActive && (
              <NearbyExploreButton
                visible={nearbyButtonVisible}
                onClick={openNearbyPanel}
              />
            )}
          </div>
      </main>

      {/* ── パネルオーバーレイ（検索のみ） ── */}
      <AnimatePresence>
        {activePanel === 'search' && (
          <>
            {/* マップ暗幕 */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-[9989] bg-black/60"
            />

            {/* パネル本体（半透明背景） */}
            <motion.div
              key={activePanel}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 320 }}
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.3 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 500) {
                  router.push("/map");
                }
              }}
              className="fixed inset-x-0 bottom-0 z-[9990] overflow-hidden rounded-t-3xl bg-black/50 backdrop-blur-xl"
              style={{ height: "92dvh" }}
            >
              {/* ドラッグハンドル */}
              <div
                className="absolute left-1/2 top-0 z-10 flex h-8 w-full -translate-x-1/2 cursor-grab items-center justify-center active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
                style={{ touchAction: "none" }}
              >
                <div className="h-1 w-10 rounded-full bg-white/40" />
              </div>
              <div className="h-full overflow-hidden pt-6">
                <Suspense fallback={null}>
                  <SearchClient
                    shops={shops}
                    landmarks={landmarks}
                    embedded
                    initialQuery={mapSearchQuery}
                    initialCategory={mapSearchCategory}
                    onQueryChange={(q, cat) => {
                      setMapSearchQuery(q);
                      setMapSearchCategory(cat);
                      if (searchMarkerPayload) {
                        clearSearchMapPayload();
                        setSearchMarkerPayload(null);
                      }
                      if (aiMarkerPayload) {
                        setAiMarkerPayload(null);
                      }
                    }}
                  />
                </Suspense>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {shouldShowNavigationBar && (
        <NavigationBar
          onMenuOpenChange={(open) => {
            if (open) {
              closeMapCharacterConsult();
              closeNearbyPanel();
            }
          }}
          onConsultClick={startMapCharacterConsult}
          closeModeActive={hasSearchMode || hasAiMode || !!nearbyState}
          onCloseMode={closeMapInteractionMode}
        />
      )}
    </div>
  );
}


