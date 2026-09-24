"use client";

import { memo, useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useReducedMotion } from "framer-motion";
import {
  MapPin,
  Heart,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Globe,
  X as XIcon,
  Sparkles,
} from "lucide-react";
import { Shop } from "../data/shops";
import { useAuth } from "../../../../lib/auth/AuthContext";
import { getShopPreviewImage } from "../../../../lib/shopImages";
import {
  isProductFavorited,
  isShopFavorited,
  toggleFavoriteProduct,
} from "../../../../lib/favoriteShops";
import { useFavoriteEntries } from "../../../../lib/hooks/useFavorites";
import { useShopFavoriteToggle } from "../../../components/favorites/useShopFavoriteToggle";
import { incrementBannerOpens } from "../../../../lib/storage/marketStats";
import { useCenterBounceTrigger } from "../../../../lib/hooks/useCenterBounceTrigger";
import {
  ShopBannerHero,
  ShopBusinessInfoCard,
  resolveBannerTheme,
  type ActivePostItem,
} from "./ShopBannerHero";
import { PostCarousel } from "./PostCarousel";
import { AiConsultPanel } from "./AiConsultPanel";
import { ShopFavoriteToast } from "./ShopFavoriteToast";
import {
  useShopDetailDrawer,
  isMainSurface,
  type MainSurface,
  type BannerSurface,
} from "./useShopDetailDrawer";

// ─── Types ────────────────────────────────────────────────────────────────────
type ShopDetailBannerProps = {
  shop: Shop;
  onClose?: () => void;
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

// ─── Constants ────────────────────────────────────────────────────────────────
const OSEKKAI_FALLBACK =
  "あら、ここのお店、最近行ってないねぇ。今日は何が出ちゅうか、ちょっと見てきてくれん？";
const BOTTOM_NAV_HEIGHT = 56;


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
    prev.onClose === next.onClose &&
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
  const prefersReducedMotion = useReducedMotion();
  const { permissions } = useAuth();
  const favoriteEntries = useFavoriteEntries();
  const { toggleShopFavorite, confirmDialog: removeShopFavoriteDialog } =
    useShopFavoriteToggle();
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
  const mainScrollTopRef = useRef(0);
  const bottomNavOffsetPx = reserveBottomNavSpace ? BOTTOM_NAV_HEIGHT : 0;

  const {
    isMobileOverlay,
    sheetBodyRef,
    drawerHeights,
    lastMainSurfaceRef,
    syncDrawerSurface,
    handleDrawerTouchStart,
    handleDrawerTouchMove,
    handleDrawerTouchEnd,
    handleDrawerHandleClick,
  } = useShopDetailDrawer({
    layout,
    initialMobileSurface,
    openNonce,
    shopId: shop.id,
    bottomNavOffsetPx,
    surface,
    setSurface,
    onMobileMainSurfaceChange,
  });

  // body scroll lock
  useEffect(() => {
    if (layout !== "overlay" || typeof document === "undefined") return;
    document.body.classList.add("shop-banner-open");
    return () => { document.body.classList.remove("shop-banner-open"); };
  }, [layout]);

  // バナー開封カウント
  useEffect(() => {
    incrementBannerOpens();
  }, [shop.id, openNonce]);

  const handleProductTap = useCallback((product: string) => {
    const nextEntries = toggleFavoriteProduct(shop.id, product);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    // 外したときは黙って消す。入れたときだけ、どこに入ったかを伝える
    if (isProductFavorited(nextEntries, shop.id, product)) {
      setToast({ product });
      toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    } else {
      setToast(null);
    }
  }, [shop.id]);

  const handleUndoAdd = useCallback((product: string) => {
    toggleFavoriteProduct(shop.id, product);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, [shop.id]);

  // 商品がぶら下がっているときの確認は useShopFavoriteToggle が持つ
  const handleToggleShopFavorite = useCallback(() => {
    toggleShopFavorite(shop.id);
  }, [toggleShopFavorite, shop.id]);

  const handleFavoritesClick = useCallback(() => { router.push("/favorites"); }, [router]);

  const isShopFavorite = isShopFavorited(favoriteEntries, shop.id);
  const canEditShop = permissions.canEditShop(shop.vendorId ?? "");
  const bannerImage = getShopPreviewImage(shop);

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
    // モバイルのドロワー高さ自体のリセットは useShopDetailDrawer 内の
    // useLayoutEffect（同じ initialMobileSurface / openNonce / shopId を見ている）が担う
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    armInteractionLock();
    return () => {
      if (interactionLockTimerRef.current) clearTimeout(interactionLockTimerRef.current);
    };
  }, [armInteractionLock, initialMobileSurface, lastMainSurfaceRef, shop.id, openNonce]);

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
  const isExpandedMobileMain = isMobileOverlay && surface === "detail";
  const showMobileSummaryHeader = isMobileOverlay && surface === "summary";
  const showMobileDetailControls = isMobileOverlay && surface === "detail";

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
  }, [armInteractionLock, isMobileOverlay, lastMainSurfaceRef, syncDrawerSurface]);

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
  }, [contentInteractive, isMobileOverlay, lastMainSurfaceRef, surface, syncDrawerSurface]);

  // ─── Theme ──────────────────────────────────────────────────────────────────
  const theme = resolveBannerTheme(shop.themeColor);

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
              style={{ height: `${drawerHeights.peek}px` }}
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
            <div
              className={`flex h-full ${
                contentInteractive ? "pointer-events-auto" : "pointer-events-none"
              }`}
            >
              {/* ── Main panel ─────────────────────────────────────────────── */}
              <div
                ref={scrollContainerRef}
                className={`h-full w-full overflow-y-auto ${isInline ? "px-0 pb-16 pt-0" : isMobileOverlay ? "pb-10" : "pb-10 md:pb-16"}`}
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
            onEdit={canEditShop ? handleEditShop : undefined}
            isFavorite={isShopFavorite}
            onToggleFavorite={handleToggleShopFavorite}
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
            />
          </div>
        )}

        {/* ── Accent color bar ─────────────────────────────────────────────── */}
        <div className="h-1 w-full" style={{ backgroundColor: theme.accent }} />

        {isMobileOverlay && (
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
                        onClick={handleFavoritesClick}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-100"
                      >
                        <Heart className="h-3.5 w-3.5" />
                        お気に入り
                      </button>
                    )}
                  </div>
                  {shop.products.length > 0 ? (
                    <div className="space-y-2.5">
                      {shop.products.map((product) => {
                        const isProductFavorite = isProductFavorited(favoriteEntries, shop.id, product);
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
                              aria-pressed={isProductFavorite}
                              aria-label={
                                isProductFavorite
                                  ? `${product}をお気に入りから外す`
                                  : `${product}をお気に入りに入れる`
                              }
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition active:scale-95 ${
                                isProductFavorite
                                  ? "border-favorite-line bg-favorite-fg text-white"
                                  : "border-favorite-line bg-white text-favorite-fg hover:bg-favorite-bg"
                              }`}
                            >
                              <Heart
                                className="h-[18px] w-[18px]"
                                fill={isProductFavorite ? "currentColor" : "none"}
                              />
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
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PRODUCTS — 商品と値段（ヒーロー直下に移動）
        ══════════════════════════════════════════════════════════════════ */}
        {!isMobileOverlay && shop.products.length > 0 && (
          <div className="px-5 pt-4 pb-2">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: theme.text }}>
                商品
              </p>
              <button
                type="button"
                onClick={handleFavoritesClick}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
              >
                <Heart className="h-3.5 w-3.5" />
                お気に入り
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {shop.products.map((product) => {
                const isProductFavorite = isProductFavorited(favoriteEntries, shop.id, product);
                const price = shop.productPrices?.[product] ?? null;
                return (
                  <button
                    key={product}
                    type="button"
                    onClick={() => handleProductTap(product)}
                    aria-pressed={isProductFavorite}
                    className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm font-semibold shadow-sm transition hover:shadow-md ${
                      isProductFavorite
                        ? "border-favorite-line bg-favorite-bg text-favorite-fg"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <Heart
                      className={`h-3.5 w-3.5 shrink-0 ${isProductFavorite ? "text-favorite-fg" : "text-slate-300"}`}
                      fill={isProductFavorite ? "currentColor" : "none"}
                    />
                    <span>{product}</span>
                    {price != null && (
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${isProductFavorite ? "bg-white text-favorite-fg" : "bg-slate-100 text-slate-500"}`}>
                        ¥{price.toLocaleString()}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            IDENTITY — Owner, location, quick info
        ══════════════════════════════════════════════════════════════════ */}
        {!isMobileOverlay && (
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
          {activePosts.length > 0 && !isMobileOverlay && (
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

          {/* ════════════════════════════════════════════════════════════════
              STALL INFO — Style, payment, rain policy
          ════════════════════════════════════════════════════════════════ */}
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

          {/* ════════════════════════════════════════════════════════════════
              AI CONSULT — Dedicated card
          ════════════════════════════════════════════════════════════════ */}
          {!isMobileOverlay && (
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

          </div>{/* space-y-6 */}
          </div>{/* main panel */}
        </div>

        {/* ── AI panel (absolute overlay) ─────── */}
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

      <ShopFavoriteToast
        product={toast?.product ?? null}
        onUndo={handleUndoAdd}
        reduceMotion={!!prefersReducedMotion}
      />

      {removeShopFavoriteDialog}
    </div>
  );
}, areShopDetailBannerPropsEqual);

export default ShopDetailBanner;


