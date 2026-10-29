"use client";

import { memo, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { recordShopView, sourceFromReferrer } from "@/lib/analytics/shopViews";
import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  Heart,
  ChevronDown,
  ChevronRight,
  X as XIcon,
  Sparkles,
  Share2,
  Navigation,
} from "lucide-react";
import { Shop } from "../data/shops";
import { formatShopIdToCode } from "@/lib/shops/route";
import { getShopPreviewImage, getShopThumbnailImage } from "../../../../lib/shopImages";
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
  ShopInfoList,
  resolveBannerTheme,
  type ActivePostItem,
} from "./ShopBannerHero";
import { PostCarousel } from "./PostCarousel";
import { ShopPhotoViewer, type ShopPhoto } from "./ShopPhotoViewer";
import { ShopProductGrid, formatProductPrice } from "./ShopProductGrid";
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
  reserveBottomNavSpace?: boolean;
  /** 「ここへ案内」。おでかけサポートでこの店への道案内を始める。無ければボタンを出さない */
  onNavigate?: () => void;
};

// ─── Constants ────────────────────────────────────────────────────────────────
const OSEKKAI_FALLBACK =
  "あら、ここのお店、最近行ってないねぇ。今日は何が出ちゅうか、ちょっと見てきてくれん？";
const BOTTOM_NAV_HEIGHT = 56;

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-[15px] font-bold text-nicchyo-ink">{children}</h3>;
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
    prev.onClose === next.onClose &&
    prev.onNavigate === next.onNavigate &&
    prev.layout === next.layout &&
    prev.openNonce === next.openNonce &&
    prev.initialMobileSurface === next.initialMobileSurface &&
    prev.onMobileMainSurfaceChange === next.onMobileMainSurfaceChange &&
    prev.reserveBottomNavSpace === next.reserveBottomNavSpace
  );
}

const ShopDetailBanner = memo(function ShopDetailBanner({
  shop,
  onClose,
  onNavigate,
  originRect,
  layout = "overlay",
  openNonce = 0,
  initialMobileSurface = "detail",
  onMobileMainSurfaceChange,
  reserveBottomNavSpace = true,
}: ShopDetailBannerProps) {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const favoriteEntries = useFavoriteEntries();
  const { toggleShopFavorite, confirmDialog: removeShopFavoriteDialog } =
    useShopFavoriteToggle();
  const [currentPostIndex, setCurrentPostIndex] = useState(0);
  const [heroImageError, setHeroImageError] = useState(false);
  /** 写真の拡大表示で開いている写真の番号。閉じているときは null */
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
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

  // 出店者の「お店の分析」のために、お店が開かれたことを数える（同じタブでは1店1回）
  useEffect(() => {
    recordShopView(
      shop.id,
      layout === "inline" ? sourceFromReferrer(document.referrer, window.location.origin) : "map"
    );
  }, [shop.id, layout]);

  // お気に入りは商品名の日本語の原文で保存する（英語表示で訳された名前でも、言語を切り替えてもずれない）
  const productOriginalNames = shop.productOriginalNames;
  const favoriteKeyOf = useCallback(
    (product: string) => productOriginalNames?.[product] ?? product,
    [productOriginalNames]
  );

  const handleProductTap = useCallback((product: string) => {
    const nextEntries = toggleFavoriteProduct(shop.id, favoriteKeyOf(product));
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    // 外したときは黙って消す。入れたときだけ、どこに入ったかを伝える
    if (isProductFavorited(nextEntries, shop.id, favoriteKeyOf(product))) {
      setToast({ product });
      toastTimerRef.current = setTimeout(() => setToast(null), 3500);
    } else {
      setToast(null);
    }
  }, [shop.id, favoriteKeyOf]);

  const handleUndoAdd = useCallback((product: string) => {
    toggleFavoriteProduct(shop.id, favoriteKeyOf(product));
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(null);
  }, [shop.id, favoriteKeyOf]);

  // 商品がぶら下がっているときの確認は useShopFavoriteToggle が持つ
  const handleToggleShopFavorite = useCallback(() => {
    toggleShopFavorite(shop.id);
  }, [toggleShopFavorite, shop.id]);

  const handleFavoritesClick = useCallback(() => { router.push("/favorites"); }, [router]);

  const isShopFavorite = isShopFavorited(favoriteEntries, shop.id);
  // 全周写真の店は、バナーにはサムネイルを出し、重い本体はタップして拡大表示を開いたときに読む。
  // 全周かどうかは、登録のときに付けたラベル（images.mainKind）で決める
  const mainImage = shop.images?.main;
  const hasPanoramaBanner = !!mainImage && shop.images?.mainKind === "panorama";
  // サムネイルが読めないときは本体に戻す（全周写真の店でも写真が消えないように）
  const [panoramaThumbFailed, setPanoramaThumbFailed] = useState(false);
  const bannerImage = hasPanoramaBanner && !panoramaThumbFailed ? getShopThumbnailImage(shop) : getShopPreviewImage(shop);
  // 拡大表示で開く写真。全周写真の店は、バナーのサムネイルでなく本体
  const handleHeroImageError = useCallback(() => {
    if (hasPanoramaBanner && !panoramaThumbFailed && bannerImage !== mainImage) setPanoramaThumbFailed(true);
    else setHeroImageError(true);
  }, [bannerImage, hasPanoramaBanner, mainImage, panoramaThumbFailed]);
  const heroPhotoSrc = hasPanoramaBanner && mainImage ? mainImage : bannerImage;


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
  const productImageOf = useCallback(
    (product: string) => productDetailsByName.get(product.trim().toLowerCase())?.imageUrl,
    [productDetailsByName]
  );

  // 拡大表示で順に見られる写真。出店者が出した店の写真（既定のカテゴリ画像や小さいサムネイルは除く）と、商品の写真
  const shopPhotoSources = useMemo(
    // バナーの写真は main が無いと thumbnail になる（getShopPreviewImage）。それも拡大できるよう、最後に加える
    () => Array.from(new Set([shop.images?.main, ...(shop.images?.additional ?? []), shop.images?.thumbnail].filter((src): src is string => !!src))),
    [shop.images]
  );
  const photos = useMemo<ShopPhoto[]>(() => [
    ...(heroImageError ? [] : shopPhotoSources).map((src) => ({
      src,
      alt: `${shop.name}の写真`,
      caption: shop.name,
      kind: src === mainImage ? shop.images?.mainKind : undefined,
    })),
    ...shop.products.flatMap((product) => {
      const src = productImageOf(product);
      const price = shop.productPrices?.[product];
      return src ? [{ src, alt: `${product}の写真`, caption: price != null ? `${product}　${formatProductPrice(price)}` : product }] : [];
    }),
  ], [heroImageError, mainImage, productImageOf, shop.images?.mainKind, shop.name, shop.productPrices, shop.products, shopPhotoSources]);
  const openPhoto = useCallback((src: string) => {
    const index = photos.findIndex((photo) => photo.src === src);
    if (index >= 0) setViewerIndex(index);
  }, [photos]);
  // 上の写真が出店者の写真のときだけ拡大できる（既定のカテゴリ画像は拡大しても仕方がない）
  const handleOpenHeroPhoto = useMemo(
    () => (shopPhotoSources.includes(heroPhotoSrc) ? () => openPhoto(heroPhotoSrc) : undefined),
    [heroPhotoSrc, openPhoto, shopPhotoSources]
  );

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
    setPanoramaThumbFailed(false);
    setViewerIndex(null);
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

  // ─── 共有 ──────────────────────────────────────────────────────────────────
  // 店舗ページ（/shops/001）の URL を送る。OGP があるので LINE では店名と写真のカードになる。
  // 共有シートが使える端末はそれを出し、無い端末は LINE の共有画面へ（URL はクリップボードにも入れる）
  const shareCode = formatShopIdToCode(shop.id) ?? String(shop.id);
  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/shops/${shareCode}`;
    const title = `${shop.name}｜高知・日曜市 ${shareCode}番`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text: title, url });
      } catch {
        // 利用者がキャンセルしたときも来る。何もしない
      }
      return;
    }
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      // クリップボードが使えない環境。LINE の共有画面だけ開く
    }
    window.open(
      `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }, [shareCode, shop.name]);

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
            className="absolute right-8 top-8 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow backdrop-blur-sm transition hover:bg-black/50"
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
                onImageError={handleHeroImageError}
                mode="compact"
                onOpenPhoto={handleOpenHeroPhoto}
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
                className="pointer-events-auto absolute right-8 top-8 z-40 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white shadow backdrop-blur-sm transition hover:bg-black/50"
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
        {/* PC とモバイルで同じ中身を同じ順に出す。違うのは外枠（モバイルは下から出るシート、PC は横のパネル）だけ */}

        {/* ── 写真 ─────────────────────────────────────────────────────────── */}
        {(!isMobileOverlay || isExpandedMobileMain) && (
          <div className="px-5 pt-4">
            <ShopBannerHero
              shop={shop}
              bannerImage={bannerImage}
              theme={theme}
              heroImageError={heroImageError}
              onImageError={handleHeroImageError}
              mode="expanded"
              isPanorama={hasPanoramaBanner}
              isFavorite={isShopFavorite}
              onToggleFavorite={handleToggleShopFavorite}
              onOpenPhoto={handleOpenHeroPhoto}
            />
          </div>
        )}

        {/* ── ここへ案内 / 共有 ─────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-5 pt-4">
          {onNavigate && (
            <motion.button
              type="button"
              onClick={onNavigate}
              whileTap={{ scale: 0.96 }}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-chip bg-nicchyo-accent text-[14px] font-black text-nicchyo-ink shadow-pop"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              ここへ案内
            </motion.button>
          )}
          <motion.button
            type="button"
            onClick={handleShare}
            whileTap={{ scale: 0.96 }}
            aria-label="このお店を共有する"
            className={`flex h-11 items-center justify-center gap-2 rounded-chip bg-white px-4 text-[14px] font-bold text-nicchyo-ink shadow-chip ring-1 ring-line active:bg-nicchyo-ink/[0.04] ${onNavigate ? "" : "flex-1"}`}
          >
            <Share2 className="h-4 w-4" aria-hidden />
            共有
          </motion.button>
        </div>

        <div className="space-y-6 px-5 pb-8 pt-5">
          {/* ── お店の情報（先頭の2行と SNS・サイト。ほかは「もっと見る」で開く） ── */}
          {/* 店が変わったら「もっと見る」を閉じた状態に戻す */}
          <ShopInfoList key={shop.id} shop={shop} />

          {/* ── 今日のお知らせ ──────────────────────────────────────────── */}
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

          {/* ── 商品（写真が主役） ──────────────────────────────────────── */}
          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <SectionTitle>商品</SectionTitle>
              {shop.products.length > 0 && (
                <button
                  type="button"
                  onClick={handleFavoritesClick}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-chip px-3 text-xs font-semibold text-nicchyo-ink/70 ring-1 ring-line transition hover:bg-nicchyo-ink/[0.03]"
                >
                  <Heart className="h-3.5 w-3.5" aria-hidden />
                  お気に入り
                </button>
              )}
            </div>
            <ShopProductGrid
              shop={shop}
              imageOf={productImageOf}
              isProductFavorite={(product) => isProductFavorited(favoriteEntries, shop.id, favoriteKeyOf(product))}
              onToggleProduct={handleProductTap}
              onOpenPhoto={openPhoto}
            />
          </section>

          {/* ── お店のこだわり ──────────────────────────────────────────── */}
          <section>
            <div className="mb-2.5">
              <SectionTitle>お店のこだわり</SectionTitle>
            </div>
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                <Image
                  src="/images/obaasan_transparent.webp"
                  alt="おせっかいばあちゃん"
                  width={60}
                  height={60}
                  className="h-14 w-14 opacity-80"
                />
              </div>
              <div
                className="relative w-full rounded-card border px-4 py-3 text-sm leading-relaxed text-nicchyo-ink"
                style={{ borderColor: theme.border, backgroundColor: theme.bg }}
              >
                <span className="absolute -left-2 top-4 h-3.5 w-3.5 rotate-45 border-b border-l" style={{ borderColor: theme.border, backgroundColor: theme.bg }} aria-hidden />
                <span className="font-semibold">{shop.shopStrength?.trim() || OSEKKAI_FALLBACK}</span>
              </div>
            </div>
          </section>

          {/* ── AI に相談 ──────────────────────────────────────────────── */}
          <button
            type="button"
            onClick={handleOpenAiPanel}
            className="flex w-full items-center gap-3 rounded-card border px-4 py-3.5 text-left transition hover:opacity-90 active:scale-[0.98] motion-reduce:active:scale-100"
            style={{ borderColor: theme.border, backgroundColor: theme.light }}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.accent }}
            >
              <Sparkles className="h-5 w-5 text-white" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: theme.text }}>AIに相談する</p>
              <p className="mt-0.5 text-xs text-nicchyo-ink/55">このお店について何でも聞いてみよう</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-nicchyo-ink/40" aria-hidden />
          </button>
        </div>
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

      {viewerIndex !== null && (
        <ShopPhotoViewer photos={photos} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </div>
  );
}, areShopDetailBannerPropsEqual);

export default ShopDetailBanner;
