"use client";

import { memo, useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { safeJsonParse } from "@/lib/utils/safeJsonParse";
import type { CSSProperties, RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MapPin,
  ShoppingBag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Globe,
  X as XIcon,
  Sparkles,
  MessageSquarePlus,
} from "lucide-react";
import { Shop } from "../data/shops";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { getShopBannerImage } from "../../../../lib/shopImages";
import { useBag } from "../../../../lib/storage/BagContext";
import { incrementBannerOpens } from "../../../../lib/storage/marketStats";
import { ingredientCatalog, recipes } from "../../../../lib/recipes";
import { loadKotodute, KOTODUTE_UPDATED_EVENT, type KotoduteNote } from "../../../../lib/kotoduteStorage";
import {
  ShopBannerHero,
  ShopBusinessInfoCard,
  type ActivePostItem,
} from "./ShopBannerHero";
import { PostCarousel } from "./PostCarousel";
import { AiConsultPanel } from "./AiConsultPanel";
import { KotodutePanel, KOTODUTE_TAG_REGEX } from "./KotodutePanel";

// ─── Theme presets ────────────────────────────────────────────────────────────
const THEME_PRESETS = {
  amber:  { bg: "#FFFBEB", accent: "#F59E0B", text: "#92400E", border: "#FDE68A", light: "#FEF3C7" },
  green:  { bg: "#F0FDF4", accent: "#7ED957", text: "#166534", border: "#BBF7D0", light: "#DCFCE7" },
  orange: { bg: "#FFF7ED", accent: "#F97316", text: "#9A3412", border: "#FED7AA", light: "#FFEDD5" },
  earth:  { bg: "#FDF6EE", accent: "#B45309", text: "#7C2D12", border: "#DDB898", light: "#FEF3E2" },
  navy:   { bg: "#EFF6FF", accent: "#3B82F6", text: "#1E40AF", border: "#BFDBFE", light: "#DBEAFE" },
  rose:   { bg: "#FFF1F2", accent: "#F43F5E", text: "#9F1239", border: "#FECDD3", light: "#FFE4E6" },
} as const;

type ThemeKey = keyof typeof THEME_PRESETS;
type MainSurface = "summary" | "detail";
type BannerSurface = MainSurface | "kotodute" | "ai";

function isMainSurface(surface: BannerSurface): surface is MainSurface {
  return surface === "summary" || surface === "detail";
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ShopDetailBannerProps = {
  shop: Shop;
  bagCount?: number;
  onClose?: () => void;
  onAddToBag?: (name: string, fromShopId?: number) => void;
  variant?: "default" | "kotodute";
  originRect?: { x: number; y: number; width: number; height: number };
  layout?: "overlay" | "inline";
  openNonce?: number;
  initialMobileSurface?: MainSurface;
  onMobileMainSurfaceChange?: (surface: MainSurface) => void;
  canNavigateBetweenShops?: boolean;
  selectedShopPosition?: number;
  totalShopCount?: number;
  onSelectPreviousShop?: () => void;
  onSelectNextShop?: () => void;
  reserveBottomNavSpace?: boolean;
};

type BagItem = {
  name: string;
  fromShopId?: number;
};


// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = "nicchyo-fridge-items";
const KOTODUTE_PREVIEW_LIMIT = 3;
const OSEKKAI_FALLBACK =
  "あら、ここのお店、最近行ってないねぇ。今日は何が出ちゅうか、ちょっと見てきてくれん？";
const BOTTOM_NAV_HEIGHT = 56;
const DRAWER_PEEK_HEIGHT = 150;
const DRAWER_FULL_RATIO = 0.9;
const COLLAPSED_SUMMARY_OFFSET_PX = 10;

const buildBagKey = (name: string, shopId?: number) =>
  `${name.trim().toLowerCase()}-${shopId ?? "any"}`;


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

function loadBagItems(): BagItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return safeJsonParse<BagItem[]>(raw, []);
}

function useCenterBounceTrigger(
  rootRef: RefObject<HTMLElement | null>,
  targetRef: RefObject<HTMLElement | null>
) {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    const target = targetRef.current;
    if (!root || !target || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { setIsActive(entry.isIntersecting); },
      { root, threshold: 0.55, rootMargin: "-28% 0px -28% 0px" }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [rootRef, targetRef]);

  return isActive;
}






// ─── Main Component ───────────────────────────────────────────────────────────
function areShopDetailBannerPropsEqual(
  prev: ShopDetailBannerProps,
  next: ShopDetailBannerProps
): boolean {
  // shop は DB 再フェッチで参照が変わることがあるため id で比較する
  if (prev.shop.id !== next.shop.id) return false;
  // originRect はオブジェクトなので各フィールドで比較する
  if (
    prev.originRect?.x !== next.originRect?.x ||
    prev.originRect?.y !== next.originRect?.y ||
    prev.originRect?.width !== next.originRect?.width ||
    prev.originRect?.height !== next.originRect?.height
  ) return false;
  // 残りは primitive または useCallback / setState で安定した参照
  return (
    prev.bagCount === next.bagCount &&
    prev.onClose === next.onClose &&
    prev.onAddToBag === next.onAddToBag &&
    prev.variant === next.variant &&
    prev.layout === next.layout &&
    prev.openNonce === next.openNonce &&
    prev.initialMobileSurface === next.initialMobileSurface &&
    prev.onMobileMainSurfaceChange === next.onMobileMainSurfaceChange &&
    prev.canNavigateBetweenShops === next.canNavigateBetweenShops &&
    prev.selectedShopPosition === next.selectedShopPosition &&
    prev.totalShopCount === next.totalShopCount &&
    prev.onSelectPreviousShop === next.onSelectPreviousShop &&
    prev.onSelectNextShop === next.onSelectNextShop &&
    prev.reserveBottomNavSpace === next.reserveBottomNavSpace
  );
}

const ShopDetailBanner = memo(function ShopDetailBanner({
  shop,
  onClose,
  onAddToBag,
  variant = "default",
  originRect,
  layout = "overlay",
  openNonce = 0,
  initialMobileSurface = "detail",
  onMobileMainSurfaceChange,
  canNavigateBetweenShops = false,
  selectedShopPosition = 0,
  totalShopCount = 0,
  onSelectPreviousShop,
  onSelectNextShop,
  reserveBottomNavSpace = true,
}: ShopDetailBannerProps) {
  const router = useRouter();
  const { permissions } = useAuth();
  const { addItem, removeItem, items: bagContextItems } = useBag();
  const [bagProductKeys, setBagProductKeys] = useState<Set<string>>(new Set());
  const [kotoduteNotes, setKotoduteNotes] = useState<KotoduteNote[]>([]);
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [heroImageError, setHeroImageError] = useState(false);
  const [toast, setToast] = useState<{ product: string } | null>(null);
  const [surface, setSurface] = useState<BannerSurface>(initialMobileSurface);
  const [contentInteractive, setContentInteractive] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactionLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activePostRef = useRef<HTMLDivElement | null>(null);
  const activePostCarouselRef = useRef<HTMLDivElement | null>(null);
  const sheetBodyRef = useRef<HTMLDivElement | null>(null);
  const mainScrollTopRef = useRef(0);
  const lastMainSurfaceRef = useRef<MainSurface>(initialMobileSurface);
  const drawerRafRef = useRef<number | null>(null);
  const drawerTranslateRef = useRef(0);
  const drawerDragRef = useRef({
    active: false,
    startY: 0,
    startTranslate: 0,
    lastY: 0,
    lastTime: 0,
    velocity: 0,
  });
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });
  const [drawerSurface, setDrawerSurface] = useState<MainSurface>(initialMobileSurface);
  const drawerSurfaceRef = useRef<MainSurface>(initialMobileSurface);
  drawerSurfaceRef.current = drawerSurface;
  const [drawerHeights, setDrawerHeights] = useState({
    peek: DRAWER_PEEK_HEIGHT,
    full: 620,
  });

  // body scroll lock
  useEffect(() => {
    if (layout !== "overlay" || typeof document === "undefined") return;
    document.body.classList.add("shop-banner-open");
    return () => { document.body.classList.remove("shop-banner-open"); };
  }, [layout]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // bag sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateBag = () => {
      const items = loadBagItems();
      const keys = new Set<string>();
      items.forEach((item) => {
        const key = buildBagKey(item.name, item.fromShopId);
        keys.add(key);
        if (item.fromShopId === undefined) {
          keys.add(buildBagKey(item.name, undefined));
        }
      });
      setBagProductKeys(keys);
    };
    updateBag();
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) updateBag();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // バナー開封カウント
  useEffect(() => {
    incrementBannerOpens();
  }, [shop.id, openNonce]);

  // kotodute sync
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateKotodute = () => {
      const notes = loadKotodute().filter(
        (note) => typeof note.shopId === "number" && note.shopId === shop.id
      );
      setKotoduteNotes(notes.slice().sort((a, b) => b.createdAt - a.createdAt));
    };
    updateKotodute();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "nicchyo-kotodute-notes") updateKotodute();
    };
    const handleUpdate = () => updateKotodute();
    window.addEventListener("storage", handleStorage);
    window.addEventListener(KOTODUTE_UPDATED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(KOTODUTE_UPDATED_EVENT, handleUpdate);
    };
  }, [shop.id, openNonce]);

  const handleProductTap = useCallback((product: string) => {
    // 即追加 (Undo パターン)
    if (onAddToBag) {
      onAddToBag(product, shop.id);
    } else {
      addItem({ name: product, fromShopId: shop.id });
    }
    setBagProductKeys((prev) => {
      const next = new Set(prev);
      next.add(buildBagKey(product, shop.id));
      return next;
    });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ product });
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, [addItem, onAddToBag, shop.id]);

  const handleUndoAdd = useCallback((product: string) => {
    const item = bagContextItems.slice().reverse().find(
      (i) => i.name === product && i.fromShopId === shop.id
    );
    if (item) removeItem(item.id);
    setBagProductKeys((prev) => {
      const next = new Set(prev);
      next.delete(buildBagKey(product, shop.id));
      return next;
    });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, [bagContextItems, removeItem, shop.id]);

  const handleBagClick = useCallback(() => { router.push("/bag"); }, [router]);

  const isKotodute = variant === "kotodute";

  const matchedIngredientIds = useMemo(() => {
    if (shop.category !== "食材") return [];
    return shop.products.map((p) => findIngredientMatch(p)?.id).filter(Boolean) as string[];
  }, [shop.category, shop.products]);

  const suggestedRecipes = useMemo(() => {
    if (matchedIngredientIds.length === 0) return [];
    const ids = new Set(matchedIngredientIds);
    return recipes.filter((r) => r.ingredientIds.some((id) => ids.has(id))).slice(0, 2);
  }, [matchedIngredientIds]);

  const canEditShop = permissions.canEditShop(shop.vendorId ?? "");
  const bannerSeed = shop.position ?? shop.id;
  const bannerImage = shop.images?.main ?? getShopBannerImage(shop.category, bannerSeed);

  const handleEditShop = useCallback(() => { router.push("/my-shop"); }, [router]);

  const bannerStyle = useMemo(() => {
    if (!originRect || typeof window === "undefined") return undefined;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const originCenterX = originRect.x + originRect.width / 2;
    const originCenterY = originRect.y + originRect.height / 2;
    const translateX = originCenterX - vw / 2;
    const translateY = originCenterY - vh / 2;
    const scaleX = Math.max(0.08, originRect.width / vw);
    const scaleY = Math.max(0.08, originRect.height / vh);
    return {
      "--banner-translate-x": `${translateX}px`,
      "--banner-translate-y": `${translateY}px`,
      "--banner-scale-x": scaleX,
      "--banner-scale-y": scaleY,
    } as CSSProperties;
  }, [originRect]);

  const activePosts = useMemo(() => {
    if (shop.activePosts && shop.activePosts.length > 0) return shop.activePosts;
    if (shop.activePost) {
      return [{ text: shop.activePost.text, imageUrl: shop.activePost.imageUrl, expiresAt: shop.activePost.expiresAt, createdAt: shop.activePost.createdAt ?? "" }];
    }
    return [] as ActivePostItem[];
  }, [shop.activePost, shop.activePosts]);

  const productDetailsByName = useMemo(() => {
    const entries = (shop.productDetails ?? []).map((detail) => [
      detail.name.trim().toLowerCase(),
      detail,
    ] as const);
    return new Map(entries);
  }, [shop.productDetails]);

  const armInteractionLock = useCallback((delayMs: number = 650) => {
    if (interactionLockTimerRef.current) clearTimeout(interactionLockTimerRef.current);
    setContentInteractive(false);
    interactionLockTimerRef.current = setTimeout(() => {
      setContentInteractive(true);
    }, delayMs);
  }, []);

  useEffect(() => {
    setCurrentPostIndex(0);
    setHeroImageError(false);
    setToast(null);
    setSurface(initialMobileSurface);
    lastMainSurfaceRef.current = initialMobileSurface;
    setDrawerSurface(initialMobileSurface);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    armInteractionLock();
    return () => {
      if (interactionLockTimerRef.current) clearTimeout(interactionLockTimerRef.current);
    };
  }, [armInteractionLock, initialMobileSurface, shop.id, openNonce]);

  useEffect(() => {
    if (activePosts.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentPostIndex((prev) => (prev + 1) % activePosts.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activePosts.length]);

  useEffect(() => {
    const container = activePostCarouselRef.current;
    if (!container) return;
    const target = container.children[currentPostIndex] as HTMLElement | undefined;
    if (!target) return;
    container.scrollTo({ left: target.offsetLeft, behavior: "smooth" });
  }, [currentPostIndex]);

  const isActivePostCentered = useCenterBounceTrigger(scrollContainerRef, activePostRef);
  const isInline = layout === "inline";
  const isMobileOverlay = layout === "overlay" && !isDesktopViewport;
  const isExpandedMobileMain = isMobileOverlay && surface === "detail";
  const showMobileSummaryHeader = isMobileOverlay && surface === "summary";
  const showMobileDetailControls = isMobileOverlay && surface === "detail";
  const bottomNavOffsetPx = reserveBottomNavSpace ? BOTTOM_NAV_HEIGHT : 0;

  const getDrawerHeights = useCallback(() => {
    if (typeof window === "undefined") {
      return { peek: DRAWER_PEEK_HEIGHT, full: 620 };
    }
    const rootStyle = getComputedStyle(document.documentElement);
    const safeBottom = Number.parseFloat(rootStyle.getPropertyValue("--safe-bottom")) || 0;
    const full = Math.max(
      DRAWER_PEEK_HEIGHT + 220,
      Math.min(
        window.innerHeight - bottomNavOffsetPx - safeBottom,
        Math.round(window.innerHeight * DRAWER_FULL_RATIO - bottomNavOffsetPx)
      )
    );
    return {
      peek: Math.min(DRAWER_PEEK_HEIGHT, full),
      full,
    };
  }, [bottomNavOffsetPx]);

  const getDrawerTranslateForSurface = useCallback((
    nextSurface: MainSurface | BannerSurface,
    heights: { peek: number; full: number }
  ) => {
    const visibleHeight = nextSurface === "summary" ? heights.peek : heights.full;
    const baseTranslate = Math.max(0, heights.full - visibleHeight);
    return nextSurface === "summary"
      ? baseTranslate + COLLAPSED_SUMMARY_OFFSET_PX
      : baseTranslate;
  }, []);

  const applyDrawerTranslate = useCallback((
    nextTranslate: number,
    options?: { immediate?: boolean }
  ) => {
    if (!isMobileOverlay) return;
    const body = sheetBodyRef.current;
    if (!body) return;
    const maxTranslate = Math.max(
      0,
      drawerHeights.full - drawerHeights.peek + COLLAPSED_SUMMARY_OFFSET_PX
    );
    const clamped = Math.max(0, Math.min(maxTranslate, nextTranslate));
    drawerTranslateRef.current = clamped;
    if (options?.immediate) {
      // 同期的にDOMを更新 → ブラウザの初回ペイント前に確実に反映
      if (drawerRafRef.current !== null) {
        cancelAnimationFrame(drawerRafRef.current);
        drawerRafRef.current = null;
      }
      body.style.transition = "none";
      body.style.transform = `translate3d(0, ${clamped}px, 0)`;
    } else {
      if (drawerRafRef.current !== null) {
        cancelAnimationFrame(drawerRafRef.current);
      }
      drawerRafRef.current = requestAnimationFrame(() => {
        const target = sheetBodyRef.current;
        if (!target) return;
        target.style.transition = "transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)";
        target.style.transform = `translate3d(0, ${clamped}px, 0)`;
      });
    }
  }, [drawerHeights.full, drawerHeights.peek, isMobileOverlay]);

  const syncDrawerSurface = useCallback((
    nextSurface: MainSurface,
    options?: { immediate?: boolean }
  ) => {
    if (!isMobileOverlay) return;
    lastMainSurfaceRef.current = nextSurface;
    setDrawerSurface(nextSurface);
    applyDrawerTranslate(getDrawerTranslateForSurface(nextSurface, drawerHeights), options);
  }, [applyDrawerTranslate, drawerHeights, getDrawerTranslateForSurface, isMobileOverlay]);

  const handleDrawerTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobileOverlay || !isMainSurface(surface)) return;
    const touch = e.touches[0];
    drawerDragRef.current = {
      active: true,
      startY: touch.clientY,
      startTranslate: drawerTranslateRef.current,
      lastY: touch.clientY,
      lastTime: performance.now(),
      velocity: 0,
    };
    const body = sheetBodyRef.current;
    if (body) body.style.transition = "none";
  }, [isMobileOverlay, surface]);

  const handleDrawerTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isMobileOverlay || !drawerDragRef.current.active || !isMainSurface(surface)) return;
    const touch = e.touches[0];
    const now = performance.now();
    const dySinceLast = touch.clientY - drawerDragRef.current.lastY;
    const dt = now - drawerDragRef.current.lastTime;
    if (dt > 0) {
      drawerDragRef.current.velocity = (dySinceLast / dt) * 1000;
    }
    drawerDragRef.current.lastY = touch.clientY;
    drawerDragRef.current.lastTime = now;
    const nextTranslate =
      drawerDragRef.current.startTranslate + (touch.clientY - drawerDragRef.current.startY);
    if (e.cancelable) {
      e.preventDefault();
    }
    applyDrawerTranslate(nextTranslate, { immediate: true });
  }, [applyDrawerTranslate, isMobileOverlay, surface]);

  const handleDrawerTouchEnd = useCallback(() => {
    if (!isMobileOverlay || !drawerDragRef.current.active || !isMainSurface(surface)) return;
    drawerDragRef.current.active = false;
    const velocity = drawerDragRef.current.velocity;
    const visibleHeight = drawerHeights.full - drawerTranslateRef.current;
    const snapHeights = [drawerHeights.peek, drawerHeights.full] as const;

    let nextSurface: MainSurface = snapHeights.reduce<MainSurface>((closest, height, index) => {
      const currentDistance = Math.abs(height - visibleHeight);
      const closestDistance = Math.abs(
        (closest === "summary" ? snapHeights[0] : snapHeights[1]) - visibleHeight
      );
      return currentDistance < closestDistance
        ? index === 0
          ? "summary"
          : "detail"
        : closest;
    }, drawerSurface);

    if (velocity < -220) {
      nextSurface = "detail";
    } else if (velocity > 220) {
      nextSurface = "summary";
    }

    setSurface(nextSurface);
    syncDrawerSurface(nextSurface);
  }, [drawerHeights.full, drawerHeights.peek, drawerSurface, isMobileOverlay, surface, syncDrawerSurface]);

  const handleDrawerHandleClick = useCallback(() => {
    if (!isMobileOverlay || !isMainSurface(surface)) return;
    const nextSurface: MainSurface = drawerSurface === "summary" ? "detail" : "summary";
    setSurface(nextSurface);
    syncDrawerSurface(nextSurface);
  }, [drawerSurface, isMobileOverlay, surface, syncDrawerSurface]);

  const handleBackToMain = useCallback(() => {
    const nextSurface = lastMainSurfaceRef.current;
    setSurface(nextSurface);
    const container = scrollContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = mainScrollTopRef.current;
      });
    }
    if (isMobileOverlay) {
      syncDrawerSurface(nextSurface, { immediate: false });
    }
    armInteractionLock(420);
  }, [armInteractionLock, isMobileOverlay, syncDrawerSurface]);

  const handleOpenKotodutePanel = useCallback(() => {
    if (!contentInteractive) return;
    mainScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    if (isMainSurface(surface)) {
      lastMainSurfaceRef.current = surface;
    }
    setSurface("kotodute");
    if (isMobileOverlay) {
      syncDrawerSurface("detail");
    }
  }, [contentInteractive, isMobileOverlay, surface, syncDrawerSurface]);

  const handleOpenAiPanel = useCallback(() => {
    if (!contentInteractive) return;
    mainScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;
    if (isMainSurface(surface)) {
      lastMainSurfaceRef.current = surface;
    }
    setSurface("ai");
    if (isMobileOverlay) {
      syncDrawerSurface("detail");
    }
  }, [contentInteractive, isMobileOverlay, surface, syncDrawerSurface]);

  useEffect(() => {
    if (!isMobileOverlay) return;
    const updateDrawerHeights = () => {
      const nextHeights = getDrawerHeights();
      setDrawerHeights(nextHeights);
      // ref から読むことで stale closure / 循環依存を回避
      const nextSurface = drawerSurfaceRef.current;
      drawerTranslateRef.current = getDrawerTranslateForSurface(nextSurface, nextHeights);
      const body = sheetBodyRef.current;
      if (body) {
        body.style.transition = "none";
        body.style.transform = `translate3d(0, ${drawerTranslateRef.current}px, 0)`;
      }
    };
    updateDrawerHeights();
    window.addEventListener("resize", updateDrawerHeights);
    return () => window.removeEventListener("resize", updateDrawerHeights);
  }, [getDrawerHeights, getDrawerTranslateForSurface, isMobileOverlay]);

  useEffect(() => {
    if (!isMobileOverlay || !isMainSurface(surface)) return;
    onMobileMainSurfaceChange?.(surface);
  }, [isMobileOverlay, onMobileMainSurfaceChange, surface]);

  // useLayoutEffect で paint 前に同期的にDOMを更新 → 初回フラッシュを防ぐ
  // applyDrawerTranslate / drawerHeights を deps に入れない → 循環依存を断ち切る
  useLayoutEffect(() => {
    if (!isMobileOverlay) return;
    const nextSurface: MainSurface = initialMobileSurface;
    lastMainSurfaceRef.current = nextSurface;
    drawerSurfaceRef.current = nextSurface;
    setDrawerSurface(nextSurface);
    setSurface(nextSurface);
    const heights = getDrawerHeights();
    setDrawerHeights(heights);
    const expandedTranslate = getDrawerTranslateForSurface(nextSurface, heights);
    drawerTranslateRef.current = expandedTranslate;

    const body = sheetBodyRef.current;
    if (!body) return;

    // ① ペイント前にパネルを完全に画面外（下）に配置
    body.style.transition = "none";
    body.style.transform = `translate3d(0, ${heights.full}px, 0)`;

    // ② ペイント後、展開位置へスライドアップ（下から登場するアニメーション）
    const rafId = requestAnimationFrame(() => {
      body.style.transition = "transform 350ms cubic-bezier(0.2, 0.8, 0.2, 1)";
      body.style.transform = `translate3d(0, ${expandedTranslate}px, 0)`;
    });

    return () => cancelAnimationFrame(rafId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMobileSurface, isMobileOverlay, openNonce, shop.id]);

  useEffect(() => {
    return () => {
      if (drawerRafRef.current !== null) {
        cancelAnimationFrame(drawerRafRef.current);
      }
    };
  }, []);

  // ─── Theme ──────────────────────────────────────────────────────────────────
  const themeKey: ThemeKey = (shop.themeColor as ThemeKey) ?? "amber";
  const theme = THEME_PRESETS[themeKey] ?? THEME_PRESETS.amber;

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={
        isInline
          ? "relative min-h-[calc(100vh-7.5rem)]"
          // Mobile: bottom sheet / Desktop: side panel
          // peek 状態ではバックドロップを透明＆pointer-events-none にしてマップを操作可能にする
          : `fixed inset-0 z-[2000] flex flex-col items-end justify-end md:items-stretch md:justify-center md:!pb-0${
              isMobileOverlay && surface === "summary"
                ? " bg-transparent backdrop-blur-none pointer-events-none"
                : " bg-black/40 backdrop-blur-[2px] md:bg-slate-900/20 md:backdrop-blur-none"
            }`
      }
      style={isInline ? undefined : {
        right: "var(--desktop-menu-offset, 0px)",
        paddingBottom: `calc(${bottomNavOffsetPx}px + var(--safe-bottom, 0px))`,
      }}
    >
      {/* ── Panel container (overflow-hidden for slide rail) ───────────────── */}
      <div
        ref={sheetBodyRef}
        className={`
          relative w-full overflow-hidden bg-white flex flex-col pointer-events-auto
          ${isMobileOverlay ? "will-change-transform" : ""}
          ${isInline
            ? "h-[100vh] border-l border-slate-100 shadow-sm"
            : isMobileOverlay
              ? "rounded-t-3xl shadow-2xl"
              : `
                h-[100vh] w-[520px] max-w-[520px]
                rounded-none border-l border-slate-100
              `
          }
          ${originRect && !isInline && !isMobileOverlay ? "shop-banner-animate" : ""}
        `}
        style={isInline ? undefined : {
          ...bannerStyle,
          ...(isMobileOverlay
            ? { height: `${drawerHeights.full}px`, maxHeight: `${drawerHeights.full}px` }
            : { height: `calc(100vh - ${bottomNavOffsetPx}px)` }),
        }}
      >
        {!isMobileOverlay && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white shadow backdrop-blur-sm transition hover:bg-black/50"
            type="button"
            aria-label="閉じる"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}

          {showMobileSummaryHeader && (
            <div
              className="relative shrink-0 overflow-hidden border-b border-slate-100 bg-white px-4 pb-3 pt-2 touch-none"
              style={{ height: `${DRAWER_PEEK_HEIGHT}px` }}
              onTouchStart={handleDrawerTouchStart}
              onTouchMove={handleDrawerTouchMove}
              onTouchEnd={handleDrawerTouchEnd}
              onTouchCancel={handleDrawerTouchEnd}
            >
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleDrawerHandleClick}
                  className="flex h-8 w-16 items-center justify-center"
                  aria-label="ドロワーを展開"
                >
                  <span className="h-1.5 w-10 rounded-full bg-slate-300" />
                </button>
              </div>
              <button
                onClick={onClose}
                className="absolute right-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-sm transition hover:bg-slate-200"
                type="button"
                aria-label="閉じる"
              >
                <XIcon className="h-4 w-4" />
              </button>
              <ShopBannerHero
                shop={shop}
                bannerImage={bannerImage}
                theme={theme}
                heroImageError={heroImageError}
                onImageError={() => setHeroImageError(true)}
                mode="compact"
                isKotodute={isKotodute}
                showProductPreview
              />
            </div>
          )}

          {showMobileDetailControls && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-center px-4 pt-3">
              <button
                type="button"
                onClick={handleDrawerHandleClick}
                className="pointer-events-auto flex h-8 w-16 items-center justify-center"
                aria-label="ドロワーをたたむ"
                onTouchStart={handleDrawerTouchStart}
                onTouchMove={handleDrawerTouchMove}
                onTouchEnd={handleDrawerTouchEnd}
                onTouchCancel={handleDrawerTouchEnd}
              >
                <span className="h-1.5 w-10 rounded-full bg-white/80 shadow-sm backdrop-blur-sm" />
              </button>
              <button
                onClick={handleDrawerHandleClick}
                className="pointer-events-auto absolute right-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white shadow backdrop-blur-sm transition hover:bg-black/50"
                type="button"
                aria-label="展開をたたむ"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="relative flex-1 overflow-hidden">
            {/* ── Slide rail (2 panels: main + kotodute) ─────────────────────── */}
            <div
              className={`flex h-full transition-transform duration-300 ease-in-out ${
                contentInteractive ? "pointer-events-auto" : "pointer-events-none"
              }`}
              style={{
                width: "200%",
                transform: surface === "kotodute" ? "translateX(-50%)" : "translateX(0)",
              }}
            >
              {/* ── Main panel ─────────────────────────────────────────────── */}
              <div
                ref={scrollContainerRef}
                className={`h-full w-1/2 overflow-y-auto ${isInline ? "px-0 pb-16 pt-0" : isMobileOverlay ? "pb-10" : "pb-10 md:pb-16"}`}
              >
        {/* ══════════════════════════════════════════════════════════════════
            HERO — Full-bleed cover with gradient overlay
        ══════════════════════════════════════════════════════════════════ */}
        {!isMobileOverlay && (
          <ShopBannerHero
            shop={shop}
            bannerImage={bannerImage}
            theme={theme}
            heroImageError={heroImageError}
            onImageError={() => setHeroImageError(true)}
            mode="expanded"
            isKotodute={isKotodute}
            onEdit={canEditShop ? handleEditShop : undefined}
          />
        )}

        {isExpandedMobileMain && (
          <div className="px-5 pt-4">
            <ShopBannerHero
              shop={shop}
              bannerImage={bannerImage}
              theme={theme}
              heroImageError={heroImageError}
              onImageError={() => setHeroImageError(true)}
              mode="expanded"
              isKotodute={isKotodute}
            />
          </div>
        )}

        {/* ── Accent color bar ─────────────────────────────────────────────── */}
        <div className="h-1 w-full" style={{ backgroundColor: theme.accent }} />

        {!isKotodute && isMobileOverlay && (
          <div className="space-y-4 px-5 pt-6">
            {canNavigateBetweenShops && totalShopCount > 1 && (
              <div className="rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onSelectPreviousShop}
                    className="flex min-w-[92px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    前の店
                  </button>
                  <div className="min-w-0 flex-1 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                      他のお店に
                    </p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">
                      {selectedShopPosition} / {totalShopCount}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onSelectNextShop}
                    className="flex min-w-[92px] items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                  >
                    次の店
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}

            <ShopBusinessInfoCard shop={shop} theme={theme} />

            <div className="rounded-[30px] border border-slate-200 bg-white px-5 py-5 shadow-sm">
              <div className="space-y-5">
                {activePosts.length > 0 && (
                  <PostCarousel
                    activePosts={activePosts}
                    theme={theme}
                    currentPostIndex={currentPostIndex}
                    isActivePostCentered={isActivePostCentered}
                    activePostRef={activePostRef}
                    activePostCarouselRef={activePostCarouselRef}
                  />
                )}

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.text }}>
                        商品
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        品ぞろえと価格を並びで見比べやすくしています
                      </p>
                    </div>
                    {shop.products.length > 0 && (
                      <button
                        type="button"
                        onClick={handleBagClick}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
                      >
                        <ShoppingBag className="h-3.5 w-3.5" />
                        買い物リスト
                      </button>
                    )}
                  </div>
                  {shop.products.length > 0 ? (
                    <div className="space-y-2.5">
                      {shop.products.map((product) => {
                        const specificKey = buildBagKey(product, shop.id);
                        const anyKey = buildBagKey(product, undefined);
                        const isInBag = bagProductKeys.has(specificKey) || bagProductKeys.has(anyKey);
                        const price = shop.productPrices?.[product] ?? null;
                        const productImage = productDetailsByName.get(product.trim().toLowerCase())?.imageUrl;
                        return (
                          <div
                            key={product}
                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                          >
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-200">
                              {productImage ? (
                                <Image
                                  src={productImage}
                                  alt={`${product}の写真`}
                                  fill
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-[11px] font-semibold text-slate-400">
                                  画像
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{product}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {price != null ? `¥${price.toLocaleString()}` : "価格は現地で確認"}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleProductTap(product)}
                              className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold transition ${
                                isInBag
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-900 text-white"
                              }`}
                            >
                              {isInBag ? "もう一つ" : "追加"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      商品情報は準備中です
                    </div>
                  )}
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={handleOpenAiPanel}
                    className="flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition hover:opacity-90 active:scale-[0.98]"
                    style={{ borderColor: theme.border, backgroundColor: theme.light }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.accent }}
                    >
                      <Sparkles className="h-[18px] w-[18px] text-white" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold" style={{ color: theme.text }}>AI相談</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">他のお店と迷った時も相談できます</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenKotodutePanel}
                    className="flex items-center gap-3 rounded-2xl border bg-white px-4 py-3.5 text-left transition hover:opacity-90 active:scale-[0.98]"
                    style={{ borderColor: theme.border }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.bg }}
                    >
                      <MessageSquarePlus className="h-[18px] w-[18px]" style={{ color: theme.accent }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold" style={{ color: theme.text }}>ことづて</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {kotoduteNotes.length > 0 ? `${kotoduteNotes.length}件のコメント` : "他の人の感想を見る"}
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PRODUCTS — 商品と値段（ヒーロー直下に移動）
        ══════════════════════════════════════════════════════════════════ */}
        {!isKotodute && !isMobileOverlay && shop.products.length > 0 && (
          <div className="px-5 pt-4 pb-2">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.text }}>
                商品
              </p>
              <button
                type="button"
                onClick={handleBagClick}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                買い物リスト
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {shop.products.map((product) => {
                const specificKey = buildBagKey(product, shop.id);
                const anyKey = buildBagKey(product, undefined);
                const isInBag = bagProductKeys.has(specificKey) || bagProductKeys.has(anyKey);
                const price = shop.productPrices?.[product] ?? null;
                return (
                  <button
                    key={product}
                    type="button"
                    onClick={() => handleProductTap(product)}
                    className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm font-semibold shadow-sm transition hover:shadow-md ${
                      isInBag
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span>{product}</span>
                    {price != null && (
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${isInBag ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        ¥{price.toLocaleString()}
                      </span>
                    )}
                    {isInBag && <span className="text-emerald-500">✓</span>}
                  </button>
                );
              })}
            </div>
            {shop.category === "食材" && suggestedRecipes.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold text-slate-400">この食材で作れるレシピ</p>
                {suggestedRecipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/recipes/${recipe.id}`}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2.5 shadow-sm transition hover:bg-slate-50"
                  >
                    {recipe.heroImage && (
                      <div className="h-12 w-14 shrink-0 overflow-hidden rounded-lg">
                        <Image src={recipe.heroImage} alt={recipe.title} width={112} height={96} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">{recipe.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{recipe.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            IDENTITY — Owner, location, quick info
        ══════════════════════════════════════════════════════════════════ */}
        {!isKotodute && !isMobileOverlay && (
          <div className="px-5 pt-4 pb-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {shop.chome ?? "丁目未設定"}
              </span>
              <span>{shop.ownerName}</span>
            </div>

            <div className="mt-3">
              <ShopBusinessInfoCard shop={shop} theme={theme} />
            </div>

            {/* SNS links */}
            <div className="mt-3 flex flex-wrap gap-2">
              {shop.socialLinks?.instagram && (
                <a
                  href={shop.socialLinks.instagram.startsWith("http") ? shop.socialLinks.instagram : `https://instagram.com/${shop.socialLinks.instagram.replace(/^@/, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-medium text-pink-700 transition hover:bg-pink-100"
                >
                  <Instagram className="h-3.5 w-3.5" />
                  Instagram
                </a>
              )}
              {shop.socialLinks?.twitter && (
                <a
                  href={shop.socialLinks.twitter.startsWith("http") ? shop.socialLinks.twitter : `https://x.com/${shop.socialLinks.twitter.replace(/^@/, "")}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  𝕏
                </a>
              )}
              {shop.socialLinks?.website && (
                <a
                  href={shop.socialLinks.website.startsWith("http") ? shop.socialLinks.website : `https://${shop.socialLinks.website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                >
                  <Globe className="h-3.5 w-3.5" />
                  サイト
                </a>
              )}
            </div>
          </div>
        )}

        {/* ── Divider ──────────────────────────────────────────────────────── */}
        {!isMobileOverlay && <div className="mx-5 my-3 border-t border-slate-100" />}

        <div className={`px-5 ${isMobileOverlay ? "pb-8 pt-6 space-y-7" : "pb-6 space-y-6"}`}>

          {/* ════════════════════════════════════════════════════════════════
              TODAY'S ANNOUNCEMENT — Rich card
          ════════════════════════════════════════════════════════════════ */}
          {!isKotodute && activePosts.length > 0 && !isMobileOverlay && (
            <PostCarousel
              activePosts={activePosts}
              theme={theme}
              currentPostIndex={currentPostIndex}
              isActivePostCentered={isActivePostCentered}
              activePostRef={activePostRef}
              activePostCarouselRef={activePostCarouselRef}
            />
          )}

          {/* ════════════════════════════════════════════════════════════════
              SHOP STORY — こだわり with grandma character
          ════════════════════════════════════════════════════════════════ */}
          {!isKotodute && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: theme.text }}>
                お店のこだわり
              </p>
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <Image
                    src="/images/obaasan_transparent.png"
                    alt="おせっかいばあちゃん"
                    width={60}
                    height={60}
                    className="h-14 w-14 opacity-80"
                  />
                </div>
                <div
                  className="relative w-full rounded-2xl border px-4 py-3 text-sm leading-relaxed text-slate-700"
                  style={{ borderColor: theme.border, backgroundColor: theme.bg }}
                >
                  <span className="absolute -left-2 top-4 h-3.5 w-3.5 rotate-45 border-b border-l" style={{ borderColor: theme.border, backgroundColor: theme.bg }} aria-hidden />
                  <span className="font-semibold">{shop.shopStrength?.trim() || OSEKKAI_FALLBACK}</span>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              STALL INFO — Style, payment, rain policy
          ════════════════════════════════════════════════════════════════ */}
          {!isKotodute && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-4">
              {/* Style tags */}
              {((shop.stallStyleTags ?? []).length > 0 || shop.stallStyle || (shop.rainPolicy && shop.rainPolicy !== "undecided")) && (
                <div>
                  <p className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">出店スタイル</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(shop.stallStyleTags ?? []).map((tag) => (
                      <span key={tag} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">{tag}</span>
                    ))}
                    {shop.stallStyle && <span className="text-sm text-slate-600">{shop.stallStyle}</span>}
                  </div>
                  {shop.rainPolicy && shop.rainPolicy !== "undecided" && (
                    <p className="mt-1 text-xs text-slate-500">
                      {shop.rainPolicy === "outdoor" && "🌧 雨でも出店"}
                      {shop.rainPolicy === "tent" && "⛺ 雨でも出店（テント）"}
                      {shop.rainPolicy === "cancel" && "❌ 雨天中止"}
                    </p>
                  )}
                </div>
              )}

              {/* Payment methods */}
              {(shop.paymentMethods ?? []).length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-widest">決済方法</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(shop.paymentMethods ?? []).map((method) => {
                      const labels: Record<string, string> = { cash: "💴 現金", card: "💳 カード", paypay: "📱 PayPay", ic: "🚃 交通系IC" };
                      return (
                        <span key={method} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600">{labels[method] ?? method}</span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              AI CONSULT — Dedicated card
          ════════════════════════════════════════════════════════════════ */}
          {!isKotodute && !isMobileOverlay && (
            <button
              type="button"
              onClick={handleOpenAiPanel}
              className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition hover:opacity-90 active:scale-[0.98]"
              style={{ borderColor: theme.border, backgroundColor: theme.light }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.accent }}
              >
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold" style={{ color: theme.text }}>AIに相談する</p>
                <p className="mt-0.5 text-xs text-slate-500">このお店について何でも聞いてみよう</p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          )}

          {/* ════════════════════════════════════════════════════════════════
              KOTODUTE — User comments
          ════════════════════════════════════════════════════════════════ */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.text }}>ことづて</p>
                {kotoduteNotes.length > 0 && (
                  <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ backgroundColor: theme.light, color: theme.text }}>
                    {kotoduteNotes.length}
                  </span>
                )}
              </div>
              {kotoduteNotes.length > 0 && (
                <button type="button" onClick={handleOpenKotodutePanel} className="flex items-center gap-1 text-xs font-semibold text-slate-500 transition hover:text-slate-700">
                  もっと見る
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {kotoduteNotes.length === 0 ? (
              <button
                type="button"
                onClick={handleOpenKotodutePanel}
                className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed px-4 py-4 transition hover:opacity-80 active:scale-[0.98]"
                style={{ borderColor: theme.border, backgroundColor: theme.bg }}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: theme.light }}>
                  <MessageSquarePlus className="h-4 w-4" style={{ color: theme.accent }} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold" style={{ color: theme.text }}>一番乗りでコメントしよう！</p>
                  <p className="mt-0.5 text-xs text-slate-500">お店の感想やおすすめを教えてください</p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" />
              </button>
            ) : (
              <div className="space-y-2">
                {kotoduteNotes.slice(0, KOTODUTE_PREVIEW_LIMIT).map((note) => (
                  <div key={note.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    {note.text.replace(KOTODUTE_TAG_REGEX, "").trim()}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleOpenKotodutePanel}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-bold transition hover:opacity-80"
                  style={{ borderColor: theme.border, color: theme.text, backgroundColor: theme.bg }}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  コメントを投稿する
                </button>
              </div>
            )}
          </div>
          </div>{/* space-y-6 */}
          </div>{/* main panel */}
          {/* ── Kotodute panel ─────────────────────────────────────────── */}
          <div className="h-full w-1/2 overflow-y-auto">
            <KotodutePanel
              shop={shop}
              bannerImage={bannerImage}
              heroImageError={heroImageError}
              theme={theme}
              onBack={handleBackToMain}
              onClose={isMobileOverlay ? onClose : undefined}
            />
          </div>
        </div>

        {/* ── AI panel (absolute overlay, independent of slide rail) ─────── */}
        <div
          className="absolute inset-0 z-20 bg-white transition-transform duration-300 ease-in-out"
          style={{ transform: surface === "ai" ? "translateX(0)" : "translateX(100%)" }}
        >
          <AiConsultPanel
            shop={shop}
            bannerImage={bannerImage}
            heroImageError={heroImageError}
            theme={theme}
            onBack={handleBackToMain}
            onClose={isMobileOverlay ? onClose : undefined}
            isActive={surface === "ai"}
          />
        </div>
          </div>
      </div>

      {/* ── Undo toast ───────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[3100] flex -translate-x-1/2 items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 shadow-xl text-sm text-white">
          <span>「{toast.product}」を追加しました</span>
          <button
            type="button"
            onClick={() => handleUndoAdd(toast.product)}
            className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold transition hover:bg-white/30"
          >
            取り消す
          </button>
        </div>
      )}
    </div>
  );
}, areShopDetailBannerPropsEqual);

export default ShopDetailBanner;


