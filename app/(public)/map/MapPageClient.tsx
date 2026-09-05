"use client";

import NavigationBar from "../../components/NavigationBar";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import { Navigation } from "lucide-react";
import SearchClient from "../search/SearchClient";
import type { MapCamera as LeafletMap } from "./types/mapCamera";
import { clearSearchMapPayload, loadAiMapPayload, loadSearchMapPayload } from "../../../lib/searchMapStorage";
import NextImage from "next/image";
import { getShopBannerImage } from "../../../lib/shopImages";
const _GrandmaChatter = dynamic(() => import("./components/GrandmaChatter"), { ssr: false });
import { useAuth } from "../../../lib/auth/AuthContext";
import { SHOP_CATEGORY_NAMES } from "./data/shops";
import type { Shop } from "./data/shops";
import type { Landmark } from "./types/landmark";
import type { MapRoute } from "./types/mapRoute";
import { resolveMapFeatureFlags, type MapFeatureFlags } from "@/lib/mapFeatureFlags";
import { useMapLoading } from "../../components/MapLoadingProvider";
import MapLoadingOverlay from "../../components/MapLoadingOverlay";
import { grandmaEvents } from "./data/grandmaEvents";
import { recordMarketEnter, recordMarketExit } from "../../../lib/storage/marketStats";
import { buildSearchIndex } from "../search/lib/searchIndex";
import { useShopSearch } from "../search/hooks/useShopSearch";
import { getOrCreateConsultVisitorKey } from "../../../lib/consultVisitorKey";
import MarketStatusBar from "../../components/market/MarketStatusBar";
import { useMarketCalendar } from "../../../lib/market/useMarketCalendar";
import MapCharacterConsult from "./components/MapCharacterConsult";
import NearbyExploreButton from "./components/NearbyExploreButton";
import NearbyExplorePanel, {
  type NearbyRecommendedShop,
} from "./components/NearbyExplorePanel";
import { useNearbyPromptVisibility } from "./hooks/useNearbyPromptVisibility";
import GuideLayer from "./components/GuideLayer";
import OdekakeGuidePanel from "./components/OdekakeGuidePanel";
import GuideNavigationBar from "./components/GuideNavigationBar";
import OdekakeLaunchButton from "./components/OdekakeLaunchButton";
import { useOdekakeGuide } from "./hooks/useOdekakeGuide";
import { GUIDE_MENU_VALUE, parseGuideQuery } from "@/lib/guide/query";
import SpotCard from "./components/SpotCard";
import type { MapSpot } from "@/lib/spots";
import { filterMapVisibleLandmarks } from "./types/landmark";
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
import { stripShopIdsDirective } from "@/lib/grandma/consultUtils";
import {
  OVERVIEW_ZONE_MIN_ZOOM,
  OVERVIEW_ZONE_MAX_ZOOM,
} from "./config/displayConfig";

const MapViewLeaflet = dynamic(() => import("./components/MapView"), {
  ssr: false,
});
// MapLibre 版（移行中の並走検証用）。選ばれたときだけ読み込む。
// ssr: false にすると Next がこのチャンクの preload を HTML に出さなくなり、
// 268KB の maplibre チャンクがハイドレーション完了後にようやくダウンロードされる。
// 地図の生成自体は useEffect の中なので、サーバーでは器の div だけが描かれる。
const MapViewMapLibre = dynamic(() => import("./components/maplibre/MapViewMapLibre"), {
  ssr: true,
});

type MapPageClientProps = {
  shops: Shop[];
  landmarks: Landmark[];
  mapRoute: MapRoute;
  /** 管理画面で保存したマップ動作フラグ（未指定なら既定値） */
  featureFlags?: MapFeatureFlags;
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
  featureFlags,
}: MapPageClientProps) {
  // 描画ライブラリの選択（管理画面の設定に URL の ?mapFlags=renderer:maplibre を重ねる）
  const MapView = useMemo(() => {
    const resolved = resolveMapFeatureFlags(
      featureFlags,
      typeof window === "undefined" ? "" : window.location.search
    );
    return resolved.renderer === "maplibre" ? MapViewMapLibre : MapViewLeaflet;
  }, [featureFlags]);
  const showGrandma = false;
  const searchParams = useSearchParams();
  const router = useRouter();
  const activePanel = searchParams?.get("panel") === "search" ? "search" : null;
  const { user, permissions } = useAuth();
  const { status: mapLoadingStatus, takeOverMapLoading, reportMapStage, markMapReady } = useMapLoading();
  // 直アクセスやリロードでは、ハイドレーションが済むまで Provider のオーバーレイが出せない。
  // その間はこのページ自身が同じ画面をサーバー描画に含めておき、Provider 側が立ち上がったら引き渡す
  const [mapLoadingHandedOff, setMapLoadingHandedOff] = useState(false);
  useEffect(() => {
    takeOverMapLoading();
  }, [takeOverMapLoading]);
  useEffect(() => {
    if (mapLoadingStatus !== "idle") setMapLoadingHandedOff(true);
  }, [mapLoadingStatus]);
  const { items: bagItems } = useBag();
  const initialShopIdParam = searchParams?.get("shop");
  const isAiFocusMode = searchParams?.get("ai") === "1";
  const searchParamsKey = searchParams?.toString() ?? "";
  const initialShopId = initialShopIdParam ? Number(initialShopIdParam) : undefined;
  // おでかけサポート: ?guide=<プリセット|menu> または旧 ?facility=<カテゴリ> で開く
  const guideQuery = useMemo(
    () => parseGuideQuery(searchParams ?? null),
    // searchParams オブジェクトは毎レンダー同一とは限らないので文字列で比較する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParamsKey]
  );
  const replaceGuideParam = useCallback(
    (value: string | null) => {
      const params = new URLSearchParams(searchParamsKey);
      params.delete("facility");
      if (value) params.set("guide", value);
      else params.delete("guide");
      const query = params.toString();
      router.replace(query ? `/map?${query}` : "/map", { scroll: false });
    },
    [router, searchParamsKey]
  );
  const closeGuide = useCallback(() => replaceGuideParam(null), [replaceGuideParam]);
  const openGuideMenu = useCallback(() => replaceGuideParam(GUIDE_MENU_VALUE), [replaceGuideParam]);
  // マップに常時描画するランドマーク（お手洗い・休けいなど show_on_map=false は除く）
  const mapLandmarks = useMemo(() => filterMapVisibleLandmarks(landmarks), [landmarks]);
  // タップしたスポット（電停・駅・建物・施設）。店舗以外は SpotCard で表示する
  const [selectedSpot, setSelectedSpot] = useState<MapSpot | null>(null);
  const closeSpotCard = useCallback(() => setSelectedSpot(null), []);
  // おでかけサポートの一覧やプリセットを切り替えたらカードは閉じる
  useEffect(() => {
    setSelectedSpot(null);
  }, [guideQuery]);
  const [agentOpen, setAgentOpen] = useState(false);
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
  // 開催ステータス。マップでは平常時（開催）は出さず、中止・臨時休市・特別開催のときだけバーを出す
  const { calendar: marketCalendar } = useMarketCalendar();
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
    // どの導線がセットしたか（クリア判定に使う）。
    // 'nearby' は「このへん」追い質問由来で、パネルを閉じたら消してよい。
    // 'other'（AI相談・URL・エージェント由来）は nearby の開閉では消さない。
    source: 'nearby' | 'other';
  } | null>(null);
  // 「このへん、なにがある？」：開いているパネルの内容（追い質問はパネル内で完結）
  const [nearbyState, setNearbyState] = useState<{
    summary: NearbyViewportSummary;
    center: { lat: number; lng: number };
    recommendations: NearbyRecommendedShop[];
    note: string;
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

  const guide = useOdekakeGuide({ query: guideQuery, landmarks, mapRoute, map: mapInstance });
  const guideActive = guide.active;
  // スポットカードの「ここへ案内」: 案内を開いて（URL に guide=menu）、そのスポットへ案内を始める
  const navigateToSpot = useCallback(
    (spot: MapSpot) => {
      setSelectedSpot(null);
      if (!guideActive) openGuideMenu();
      guide.startNavigation(spot);
    },
    [guide, guideActive, openGuideMenu]
  );

  const vendorShop = useMemo(() => {
    if (!vendorShopId) return null;
    return shops.find((shop) => shop.vendorId === vendorShopId) ?? null;
  }, [shops, vendorShopId]);

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
      setAiMarkerPayload({ ids: payload.ids, label: payload.label, source: 'other' });
    } else {
      setAiMarkerPayload({ ids: [], label: labelParam, source: 'other' });
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
        setAiMarkerPayload({ ids, label: parsed.title ?? 'おさんぽプラン', source: 'other' });
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
        setAiMarkerPayload({ ids: payload.shopIds, label: "AIおすすめ", source: 'other' });
        const cleaned = stripShopIdsDirective(rawReply);
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

  // ── 「このへん、なにがある？」──────────────────────
  // 他のモード（検索・AI相談・店舗バナー・パネル表示中）ではボタンを出さない
  const nearbySuppressed =
    !!nearbyState || hasSearchMode || hasAiMode || isShopBannerOpen || guideActive;
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
    // おすすめ: 行動シグナル（お気に入り・買い物リスト）から
    // 興味ジャンルを導き、範囲内の店舗（近い順）から9店を選ぶ
    const inAreaShops = summary.shopIds
      .map((id) => shopById.get(id))
      .filter((shop): shop is Shop => !!shop);
    const favoriteIds = new Set(loadFavoriteShopIds());
    const bagShopIds = bagItems
      .map((item) => item.fromShopId)
      .filter((id): id is number => typeof id === "number");
    const interestCategories = deriveInterestCategories(
      [...favoriteIds, ...bagShopIds],
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
  }, [bagItems, shopById, shops]);

  const closeNearbyPanel = useCallback(() => {
    setNearbyState(null);
    // 追い質問（nearby）由来の aiMarkerPayload だけをクリアする。
    // これを消さないと hasAiMode が true のままになり「このへん」ボタンが
    // 再表示されない。一方、AI相談（consult）由来のマーカーは無関係なので残す。
    setAiMarkerPayload((prev) => (prev?.source === 'nearby' ? null : prev));
  }, []);

  // パネル表示中にマップが動いたら閉じる（オレンジ枠は画面固定のため、
  // 移動すると要約と実際の範囲がズレてしまう）
  useEffect(() => {
    if (!nearbyState || !mapInstance) return;
    const close = () => {
      setNearbyState(null);
      setAiMarkerPayload((prev) => (prev?.source === 'nearby' ? null : prev));
    };
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

            {/* 検索バー・ジャンルフィルター周辺の地図をぼかし、UIの視認性を高める（白要素は使わない） */}
            {!mapCharacterConsultActive && !nearbyState && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-[1000] h-[100px] backdrop-blur-[1.5px] [mask-image:linear-gradient(to_bottom,black,black_55%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black,black_55%,transparent)]"
              />
            )}

            {/* おでかけサポート案内中ヘッダー：検索バーの代わりに表示 */}
            {guideActive && !mapCharacterConsultActive && !nearbyState && (
              guide.navigating && guide.selected ? (
                <GuideNavigationBar
                  target={guide.selected}
                  originLabel={guide.origin?.label ?? "現在地"}
                  arrived={guide.arrived}
                  progress={guide.progress}
                  onStop={guide.stopNavigation}
                  onOpenDetail={() => setSelectedSpot(guide.selected!.spot)}
                />
              ) : (
                <div className="absolute left-3 right-3 top-3 z-[1001] flex items-center gap-3 rounded-full bg-white py-2 pl-2 pr-2 shadow-[0_8px_24px_rgba(58,58,58,0.18)] ring-1 ring-black/5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nicchyo-accent text-nicchyo-ink" aria-hidden="true">
                    <Navigation size={15} />
                  </span>
                  <p className="flex-1 text-[14px] font-bold text-nicchyo-ink">おでかけサポート</p>
                  <button
                    type="button"
                    onClick={closeGuide}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                  >
                    とじる
                  </button>
                </div>
              )
            )}

            {/* 全幅検索バー + ジャンルフィルター（AI相談・このへん・おでかけサポートモード時は非表示） */}
            {!mapCharacterConsultActive && !nearbyState && !guideActive && (
              <div
                ref={searchAreaRef}
                className="absolute left-3 right-3 top-3 z-[1001] flex flex-col gap-2"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
              >
                {/* 開催ステータス（例外時のみ表示。平常時は null を返すので検索バーは動かない） */}
                <MarketStatusBar day={marketCalendar.day} placement="map" />

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
              landmarks={mapLandmarks}
              mapRoute={mapRoute}
              featureFlags={featureFlags}
              initialShopId={initialShopId}
              openInitialShopBanner={!isAiFocusMode}
              agentOpen={agentOpen}
              onAgentToggle={setAgentOpen}
              searchShopIds={searchMarkerPayload?.ids ?? mapSearchShopIds}
              aiShopIds={aiMarkerPayload?.ids}
              onMapReady={markMapReady}
              onMapStage={reportMapStage}
              onMapInstance={handleMapInstance}
              onSpotSelect={setSelectedSpot}
              selectedSpotId={selectedSpot?.id}
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
              // おでかけサポート表示中は施設に合わせた画角を優先し、
              // 現在地取得時の自動ズームで上書きされないようにする
              suppressInitialLocationFocus={isAiFocusMode || guideActive}
              hideMapUI={mapCharacterConsultActive || !!nearbyState}
              // おでかけサポート案内中は GuideLayer 側のマーカーだけを見せる
              suppressLandmarks={guideActive}
              trackingButtonTop={trackingButtonTop}
              onGestureActiveChange={setIsMapGestureActive}
              overlaySlot={
                mapCharacterConsultActive ? (
                  <MapCharacterConsult
                    map={mapInstance}
                    shops={shops}
                    onShopsRecommended={(shopIds) => {
                      setAiMarkerPayload({ ids: shopIds, label: 'AIおすすめ', source: 'other' });
                    }}
                  />
                ) : nearbyState ? (
                  <NearbyExplorePanel
                    summary={nearbyState.summary}
                    recommendations={nearbyState.recommendations}
                    note={nearbyState.note}
                    center={nearbyState.center}
                    onSelectShop={handleCommentShopOpen}
                    onShopsRecommended={(shopIds) => {
                      setAiMarkerPayload({ ids: shopIds, label: 'AIおすすめ', source: 'nearby' });
                    }}
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

            {/* おでかけサポートを開くボタン（現在地ボタンと同じ高さの左側） */}
            {!guideActive && !mapCharacterConsultActive && !nearbyState && !isShopBannerOpen && (
              <OdekakeLaunchButton top={trackingButtonTop} onClick={openGuideMenu} />
            )}

            {/* おでかけサポート：表示中の種別のスポットと経路を描き、一覧・案内を出す */}
            {guideActive && (
              <>
                <GuideLayer
                  map={mapInstance}
                  spots={guide.visibleSpots}
                  selectedSpotId={guide.selectedId}
                  routes={guide.routes}
                  onSelectSpot={setSelectedSpot}
                />
                {!mapCharacterConsultActive && !nearbyState && !selectedSpot && (
                  <OdekakeGuidePanel guide={guide} map={mapInstance} onClose={closeGuide} onOpenSpot={setSelectedSpot} />
                )}
              </>
            )}

            {/* スポットカード：店舗以外のスポット（電停・駅・建物・施設）をタップしたとき */}
            <AnimatePresence>
              {selectedSpot && !mapCharacterConsultActive && !nearbyState && (
                <SpotCard
                  key={selectedSpot.id}
                  spot={selectedSpot}
                  map={mapInstance}
                  origin={isInMarket && userLocation ? userLocation : null}
                  onClose={closeSpotCard}
                  onNavigate={navigateToSpot}
                />
              )}
            </AnimatePresence>
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
                    landmarks={mapLandmarks}
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
          closeModeActive={hasSearchMode || hasAiMode || !!nearbyState || guideActive}
          onCloseMode={closeMapInteractionMode}
        />
      )}

      {!mapLoadingHandedOff && <MapLoadingOverlay minStage="page" />}
    </div>
  );
}


