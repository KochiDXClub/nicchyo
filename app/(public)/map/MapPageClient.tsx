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
import { getShopPreviewImage } from "../../../lib/shopImages";
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
import { useMapSearchFilter } from "./hooks/useMapSearchFilter";
import { GenreFilter } from "./components/GenreFilter";
import { VendorShopPrompt } from "./components/VendorShopPrompt";
import MarketStatusBar from "../../components/market/MarketStatusBar";
import { useMarketCalendar } from "../../../lib/market/useMarketCalendar";
import ShopScanCards from "./components/ShopScanCards";
import NearbyExploreButton from "./components/NearbyExploreButton";
import NearbyExplorePanel, {
  type NearbyRecommendedShop,
} from "./components/NearbyExplorePanel";
import { useNearbyPromptVisibility } from "./hooks/useNearbyPromptVisibility";
import { hasMapDeepLink, MAP_INTRO_PANEL_VALUE, useMapIntro } from "./hooks/useMapIntro";
import GuideLayer from "./components/GuideLayer";
import OdekakeGuidePanel from "./components/OdekakeGuidePanel";
import GuideNavigationBar from "./components/GuideNavigationBar";
import OdekakeLaunchButton from "./components/OdekakeLaunchButton";
import { useOdekakeGuide } from "./hooks/useOdekakeGuide";
import { buildMapUrl, GUIDE_MENU_VALUE, parseGuideQuery, type GuideQuery } from "@/lib/guide/query";
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
import {
  loadFavoriteShopIds,
} from "../../../lib/favoriteShops";
import { useFavoriteShopIds } from "../../../lib/hooks/useFavorites";
import { usePageVisibility } from "@/lib/pageVisibility/PageVisibilityContext";
import { ODEKAKE_VISIBILITY_PATH } from "@/lib/pageVisibility/registry";
import {
  OVERVIEW_ZONE_MIN_ZOOM,
  OVERVIEW_ZONE_MAX_ZOOM,
} from "./config/displayConfig";

import type { MapViewSettings } from "@/lib/map/mapViewSettings";

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
// はじめての方への案内。初回か、メニューから開いたときにだけ要る。
// 二度目以降の来訪者は一度も開かないので、その人たちに読み込ませない
const MapIntroPanel = dynamic(() => import("./components/MapIntroPanel"), { ssr: false });

type MapPageClientProps = {
  shops: Shop[];
  landmarks: Landmark[];
  mapRoute: MapRoute;
  /** 管理画面で保存したマップ動作フラグ（未指定なら既定値） */
  featureFlags?: MapFeatureFlags;
  /** 管理画面で保存したマップの可動範囲（未指定なら既定値。MapLibre 版でのみ効く） */
  mapViewSettings?: MapViewSettings;
};

// 「このへん、なにがある？」の対象範囲＝画面に見えているマップの80%の長方形
const NEARBY_AREA_RATIO = 0.8;

export default function MapPageClient({
  shops,
  landmarks,
  mapRoute,
  featureFlags,
  mapViewSettings,
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
  const initialShopIdParam = searchParams?.get("shop");
  const isAiFocusMode = searchParams?.get("ai") === "1";
  const searchParamsKey = searchParams?.toString() ?? "";
  const initialShopId = initialShopIdParam ? Number(initialShopIdParam) : undefined;
  // おでかけサポート: ?guide=<プリセット|menu> または旧 ?facility=<カテゴリ> で開く
  // URL から読んだ状態。初回表示や /facilities からのリンク、共有リンクで使う
  const guideQueryFromUrl = useMemo(
    () => parseGuideQuery(searchParams ?? null),
    // searchParams オブジェクトは毎レンダー同一とは限らないので文字列で比較する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParamsKey]
  );
  // おでかけサポートの開閉。
  //
  // 以前は router.replace で URL を書き換えて開閉していたが、/map は cookies() を
  // 使う動的ページなので、URL が変わるたびに店舗300件を含むページ全体をサーバーから
  // 取り直していた（実測で1回あたり約380KB・数百ms）。画面の状態を変えるだけなのに
  // ページを読み直すのと同じ負荷がかかっていた。
  //
  // そこで開閉は画面内の状態で即座に反映し、URL は共有・リロード用に
  // history.replaceState で静かに合わせるだけにする。サーバーへは行かない。
  const [guideOverride, setGuideOverride] = useState<GuideQuery | null | undefined>(undefined);
  // おでかけサポートの公開設定（地図の一部だが、機能として単独で切り替えられる）
  //   public   : 通常どおり
  //   unlisted : 入口（起動ボタン・「ここへ案内」）を出さない。?guide= の URL からは開ける
  //   private  : 機能ごと止める。URL で指定されても開かない
  const { resolve: resolveVisibility } = usePageVisibility();
  const odekakeVisibility = resolveVisibility(ODEKAKE_VISIBILITY_PATH).state;
  const odekakeEnabled = odekakeVisibility !== "private";
  const odekakeEntryVisible = odekakeVisibility === "public";
  // 画面で開閉したらそちらを優先し、まだ触っていなければ URL の指定に従う
  const guideQuery = !odekakeEnabled
    ? null
    : guideOverride !== undefined
      ? guideOverride
      : guideQueryFromUrl;
  const isGuideActive = guideQuery !== null;
  // 現在の URL パラメータ（history.replaceState で書き換えた分も含む）を基準に、
  // 指定したパラメータを足し引きした /map URL を作る。
  // router.push や history.replaceState が他のパラメータ（guide、mapFlags、shop 等）を
  // 意図せず消してしまうのを防ぐ。
  const buildCurrentMapUrl = useCallback(
    (updates?: Record<string, string | null | undefined>) => {
      const currentSearch = typeof window !== "undefined" ? window.location.search : searchParamsKey;
      return buildMapUrl({
        currentSearch,
        guideActive: isGuideActive,
        updates,
      });
    },
    [isGuideActive, searchParamsKey]
  );
  const syncGuideUrl = useCallback(
    (value: string | null) => {
      if (typeof window === "undefined") return;
      const nextUrl = buildCurrentMapUrl({ guide: value });
      window.history.replaceState(null, "", nextUrl);
    },
    [buildCurrentMapUrl]
  );
  const closeGuide = useCallback(() => {
    setGuideOverride(null);
    syncGuideUrl(null);
  }, [syncGuideUrl]);
  const openGuideMenu = useCallback(() => {
    setGuideOverride({ kinds: [] });
    syncGuideUrl(GUIDE_MENU_VALUE);
  }, [syncGuideUrl]);

  // ── 初回案内パネル ────────────────────────────────────────────
  // 独立した LP ページを作らず、読み込み終わった地図の上に重ねて出す。
  // 地図が出きる前に被せると「LP を見てからマップへ行く」体験になるため、
  // Provider のローディングが畳まれた（= 地図が画面に出た）あとにだけ開く
  const mapArrived = mapLoadingHandedOff && mapLoadingStatus === "idle";
  const introRequested = searchParams?.get("panel") === MAP_INTRO_PANEL_VALUE;
  const introHasDeepLink = useMemo(
    () => hasMapDeepLink(searchParams ?? null),
    // searchParams オブジェクトは毎レンダー同一とは限らないので文字列で比較する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParamsKey]
  );
  const { open: introOpen, close: dismissIntro } = useMapIntro({
    requested: introRequested,
    hasDeepLink: introHasDeepLink,
    mapArrived,
  });
  // 一度でも開いたら、閉じる動きのために置いたままにする（読み込むのはこのとき）
  const [introEverOpened, setIntroEverOpened] = useState(false);
  useEffect(() => {
    if (introOpen) setIntroEverOpened(true);
  }, [introOpen]);
  const closeIntro = useCallback(() => {
    dismissIntro();
    // ?panel=intro を外す。router.push だと店舗300件を含むページを取り直すので、
    // URL は history.replaceState で静かに合わせるだけにする（おでかけサポートと同じ）
    if (introRequested && typeof window !== "undefined") {
      window.history.replaceState(null, "", buildCurrentMapUrl({ panel: null }));
    }
  }, [buildCurrentMapUrl, dismissIntro, introRequested]);
  // /facilities からのリンクなど、URL 側の指定が変わったら画面の状態を捨てて従う
  const guideUrlKey = guideQueryFromUrl ? `open:${guideQueryFromUrl.kinds.join(",")}` : "closed";
  const lastGuideUrlKeyRef = useRef(guideUrlKey);
  useEffect(() => {
    if (lastGuideUrlKeyRef.current === guideUrlKey) return;
    lastGuideUrlKeyRef.current = guideUrlKey;
    setGuideOverride(undefined);
  }, [guideUrlKey]);
  useEffect(() => {
    const handlePopState = () => {
      const query = parseGuideQuery(new URLSearchParams(window.location.search));
      setGuideOverride(query ?? null);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  // マップに常時描画するランドマーク（お手洗い・休けいなど show_on_map=false は除く）
  const mapLandmarks = useMemo(() => filterMapVisibleLandmarks(landmarks), [landmarks]);
  // タップしたスポット（電停・駅・建物・施設）。店舗以外は SpotCard で表示する
  const [selectedSpot, setSelectedSpot] = useState<MapSpot | null>(null);
  const closeSpotCard = useCallback(() => setSelectedSpot(null), []);
  // おでかけサポートの一覧やプリセットを切り替えたらカードは閉じる
  useEffect(() => {
    setSelectedSpot(null);
  }, [guideQuery]);
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
  const [mapInstance, setMapInstance] = useState<LeafletMap | null>(null);
  // ShopScanCards のカードがタップされたときに、詳細バナーを開くよう地図へ渡す要求。
  // 同じ店を続けてタップしても開き直せるよう token を進める
  const [focusShopRequest, setFocusShopRequest] = useState<{ shopId: number; token: number } | null>(null);
  const handleScanCardSelect = useCallback((shop: Shop) => {
    setFocusShopRequest((prev) => ({ shopId: shop.id, token: (prev?.token ?? 0) + 1 }));
  }, []);
  const mapRef = useRef<LeafletMap | null>(null);
  const introFocusTimerRef = useRef<number | null>(null);
  const [searchMarkerPayload, setSearchMarkerPayload] = useState<{
    ids: number[];
    label: string;
  } | null>(null);
  const favoriteShopIds = useFavoriteShopIds();
  const {
    query: mapSearchQuery,
    setQuery: setMapSearchQuery,
    category: mapSearchCategory,
    setCategory: setMapSearchCategory,
    favoritesOnly,
    setFavoritesOnly,
    results: mapSearchResults,
    shopIds: mapSearchShopIds,
    hasFilter: hasMapFilter,
  } = useMapSearchFilter({
    shops,
    favoriteShopIds,
    initialQuery: searchParams?.get("q") ?? "",
  });
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
  }, [setMapSearchCategory, setMapSearchQuery]);
  /** AI のおすすめ表示を畳む。相談そのものは /consult に集約した */
  const clearAiRecommendation = useCallback(() => {
    setAiMarkerPayload(null);
  }, []);
  /** 相談は /consult に一本化した。マップ上でキャラクターと会話する形は廃止 */
  const goToConsult = useCallback(() => {
    clearMapSearchState();
    setNearbyState(null);
    router.push('/consult');
  }, [clearMapSearchState, router]);
  const closeMapInteractionMode = useCallback(() => {
    clearMapSearchState();
    clearAiRecommendation();
    setNearbyState(null);
    closeGuide();
    router.push(buildCurrentMapUrl({ panel: null, search: null, label: null, q: null, guide: null }));
  }, [buildCurrentMapUrl, clearMapSearchState, clearAiRecommendation, closeGuide, router]);

  // 旧 URL 互換: /map?panel=consult が来たら相談ページへ送る
  useEffect(() => {
    if (searchParams?.get("panel") === "consult") {
      goToConsult();
      return;
    }
    if (activePanel === 'search') {
      clearAiRecommendation();
    }
  }, [activePanel, clearAiRecommendation, searchParams, goToConsult]);

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
      const src = getShopPreviewImage(shop);
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

  const guide = useOdekakeGuide({ query: guideQuery, landmarks, mapRoute, preload: odekakeEntryVisible });
  const guideActive = guide.active;
  /** おでかけサポートを開いたが、まだ何を探すか決めていない（中央の選択画面が出ている） */
  const isChoosingGuideKind = guideActive && guide.kinds.length === 0 && !guide.navigating;
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

  // 出店者パネルに出す写真。店が見つからないときも既定のバナーが返る（従来と同じ）
  const vendorShopImage = getShopPreviewImage(vendorShop ?? {});

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
    router.push(buildCurrentMapUrl({ shop: String(vendorShop.id) }));
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

  // 検索結果 / AI おすすめで対象が絞れているときの店舗 ID。
  // 優先順位は MapView 側の activeHighlightShopIds と同じ（検索が先、次に AI）
  const highlightShopIds = useMemo(() => {
    const search = searchMarkerPayload?.ids ?? mapSearchShopIds;
    if (search && search.length > 0) return search;
    const ai = aiMarkerPayload?.ids;
    if (ai && ai.length > 0) return ai;
    return undefined;
  }, [searchMarkerPayload, mapSearchShopIds, aiMarkerPayload]);

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
        router.push(buildCurrentMapUrl({ shop: String(shopId) }));
        introFocusTimerRef.current = null;
      }, 900);
    },
    [buildCurrentMapUrl, handleCommentShopFocus, router]
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
    hasMapFilter ||
    !!mapSearchShopIds?.length;
  const hasAiMode = !!aiMarkerPayload;

  // ── 「このへん、なにがある？」──────────────────────
  // 他のモード（検索・AI相談・店舗バナー・パネル表示中）ではボタンを出さない
  const nearbySuppressed =
    !!nearbyState || hasSearchMode || hasAiMode || isShopBannerOpen || guideActive || introOpen;
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
    // おすすめ: 行動シグナル（お気に入り）から
    // 興味ジャンルを導き、範囲内の店舗（近い順）から9店を選ぶ
    const inAreaShops = summary.shopIds
      .map((id) => shopById.get(id))
      .filter((shop): shop is Shop => !!shop);
    const favoriteIds = new Set(loadFavoriteShopIds());
    const interestCategories = deriveInterestCategories(
      [...favoriteIds],
      (id) => shopById.get(id)?.category
    );
    const recommendations: NearbyRecommendedShop[] = selectNearbyRecommendations(
      inAreaShops,
      { favoriteShopIds: favoriteIds, interestCategories, limit: 9 }
    ).map(({ shop, reason }) => ({
      shopId: shop.id,
      name: shop.name,
      category: shop.category,
      imageUrl: getShopPreviewImage(shop),
      reason,
    }));
    setNearbyState({
      summary,
      center: { lat: center.lat, lng: center.lng },
      recommendations,
      note: buildNearbyNote(summary),
    });
  }, [shopById, shops]);

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
              <VendorShopPrompt
                shopName={vendorShopName}
                shopImage={vendorShopImage}
                onOpen={handleOpenVendorBanner}
                onDismiss={() => setShowVendorPrompt(false)}
              />
            )}

            {/* 検索バー・ジャンルフィルター周辺の地図をぼかし、UIの視認性を高める（白要素は使わない） */}
            {!nearbyState && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-[1000] h-[100px] backdrop-blur-[1.5px] [mask-image:linear-gradient(to_bottom,black,black_55%,transparent)] [-webkit-mask-image:linear-gradient(to_bottom,black,black_55%,transparent)]"
              />
            )}

            {/*
              おでかけサポート案内中ヘッダー：検索バーの代わりに表示。
              種類をえらんでいる間は出さない。中央の選択画面に閉じるボタンがあり、
              上にも「とじる」を出すと閉じ方が複数見えて迷わせるため
            */}
            {guideActive && !isChoosingGuideKind && !nearbyState && (
              guide.navigating && guide.selected ? (
                <GuideNavigationBar
                  target={guide.selected}
                  originLabel={guide.origin?.label ?? "現在地"}
                  arrived={guide.arrived}
                  progress={guide.progress}
                  onStop={guide.stopNavigation}
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
            {!nearbyState && !guideActive && (
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
                  hasMapFilter
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
                  {hasMapFilter && (
                    <span className="shrink-0 rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                      {mapSearchShopIds?.length ?? mapSearchResults.length}件
                    </span>
                  )}
                  {hasMapFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setMapSearchQuery('');
                        setMapSearchCategory(null);
                        setFavoritesOnly(false);
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
                  favoritesActive={favoritesOnly}
                  favoriteCount={favoriteShopIds.length}
                  onToggleFavorites={() => setFavoritesOnly((prev) => !prev)}
                />
              </div>
            )}

            <MapView
              shops={shops}
              landmarks={mapLandmarks}
              mapRoute={mapRoute}
              featureFlags={featureFlags}
              mapViewSettings={mapViewSettings}
              initialShopId={initialShopId}
              openInitialShopBanner={!isAiFocusMode}
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
                setFavoritesOnly(false);
                setAiMarkerPayload(null);
              }}
              // おでかけサポート表示中は施設に合わせた画角を優先し、
              // 現在地取得時の自動ズームで上書きされないようにする
              suppressInitialLocationFocus={isAiFocusMode || guideActive}
              hideMapUI={!!nearbyState}
              // おでかけサポート案内中は GuideLayer 側のマーカーだけを見せる
              suppressLandmarks={guideActive}
              focusShopRequest={focusShopRequest}
              trackingButtonTop={trackingButtonTop}
              onGestureActiveChange={setIsMapGestureActive}
              overlaySlot={
                nearbyState ? (
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

            {/* 地図を動かしているあいだだけ、屋台マーカーの上に写真と名前を重ねる。
                静止時は地図の絵を優先し、探しているときだけ情報を前に出す。
                出るのは MapLibre 版だけ（Leaflet 版は回転シェルの中の座標が返るため。
                ShopScanCards の先頭コメント参照）で、判定は中で行っている */}
            <ShopScanCards
              map={mapInstance}
              shops={shops}
              highlightShopIds={highlightShopIds}
              onSelectShop={handleScanCardSelect}
              enabled={
                !nearbyState &&
                !guideActive &&
                !isShopBannerOpen
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
            <NearbyExploreButton
              visible={nearbyButtonVisible}
              onClick={openNearbyPanel}
            />

            {/* おでかけサポートを開くボタン（現在地ボタンと同じ高さの左側） */}
            {odekakeEntryVisible && !guideActive && !nearbyState && !isShopBannerOpen && (
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
                {!nearbyState && !selectedSpot && (
                  <OdekakeGuidePanel guide={guide} map={mapInstance} onClose={closeGuide} onOpenSpot={setSelectedSpot} />
                )}
              </>
            )}

            {/* スポットカード：店舗以外のスポット（電停・駅・建物・施設）をタップしたとき */}
            <AnimatePresence>
              {selectedSpot && !nearbyState && (
                <SpotCard
                  key={selectedSpot.id}
                  spot={selectedSpot}
                  map={mapInstance}
                  origin={isInMarket && userLocation ? userLocation : null}
                  onClose={closeSpotCard}
                  onNavigate={odekakeEntryVisible ? navigateToSpot : undefined}
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
                  router.push(buildCurrentMapUrl({ panel: null }));
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
              clearAiRecommendation();
              closeNearbyPanel();
            }
          }}
          onConsultClick={goToConsult}
          closeModeActive={hasSearchMode || hasAiMode || !!nearbyState || guideActive}
          onCloseMode={closeMapInteractionMode}
        />
      )}

      {/* 初来訪者への案内。地図が出たあとに下から重なり、上には地図が見えたままになる */}
      {/* 開閉の動きは MapIntroPanel の中の AnimatePresence が受け持つ */}
      {introEverOpened && (
        <MapIntroPanel
          open={introOpen}
          shops={shops}
          landmarks={landmarks}
          mapRoute={mapRoute}
          showOdekake={odekakeEntryVisible}
          onClose={closeIntro}
        />
      )}

      {!mapLoadingHandedOff && <MapLoadingOverlay minStage="page" />}
    </div>
  );
}


