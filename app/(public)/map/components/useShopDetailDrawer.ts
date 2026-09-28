import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export type MainSurface = "summary" | "detail";
export type BannerSurface = MainSurface | "ai";

export function isMainSurface(surface: BannerSurface): surface is MainSurface {
  return surface === "summary" || surface === "detail";
}

const DRAWER_PEEK_HEIGHT = 150;
const DRAWER_FULL_RATIO = 0.9;
const COLLAPSED_SUMMARY_OFFSET_PX = 10;

/**
 * ShopDetailBanner のモバイル用ボトムシート（ドロワー）の開閉・ドラッグ物理演算を
 * まとめたフック。
 *
 * 「今どのくらいの高さで出ているか」（summary=peek / detail=full）を
 * translateY で表現し、指の動きにそのまま追従させたあと、離した位置と速度から
 * 一番近い/意図が読める高さへスナップさせる。パネル自体の状態（"ai" を含む
 * BannerSurface）は呼び出し側が持ち、ここではモバイルのドロワー高さの同期だけを
 * 引き受ける。
 */
export function useShopDetailDrawer({
  layout,
  initialMobileSurface,
  openNonce,
  shopId,
  bottomNavOffsetPx,
  surface,
  setSurface,
  onMobileMainSurfaceChange,
}: {
  layout: "overlay" | "inline";
  initialMobileSurface: MainSurface;
  openNonce: number;
  shopId: number;
  bottomNavOffsetPx: number;
  surface: BannerSurface;
  setSurface: Dispatch<SetStateAction<BannerSurface>>;
  onMobileMainSurfaceChange?: (surface: MainSurface) => void;
}) {
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth >= 768;
  });
  const isMobileOverlay = layout === "overlay" && !isDesktopViewport;

  const [drawerSurface, setDrawerSurface] = useState<MainSurface>(initialMobileSurface);
  const drawerSurfaceRef = useRef<MainSurface>(initialMobileSurface);
  drawerSurfaceRef.current = drawerSurface;
  const [drawerHeights, setDrawerHeights] = useState({
    peek: DRAWER_PEEK_HEIGHT,
    full: 620,
  });
  const lastMainSurfaceRef = useRef<MainSurface>(initialMobileSurface);
  const sheetBodyRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => {
      setIsDesktopViewport(window.innerWidth >= 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
  }, [drawerHeights.full, drawerHeights.peek, drawerSurface, isMobileOverlay, setSurface, surface, syncDrawerSurface]);

  const handleDrawerHandleClick = useCallback(() => {
    if (!isMobileOverlay || !isMainSurface(surface)) return;
    const nextSurface: MainSurface = drawerSurface === "summary" ? "detail" : "summary";
    setSurface(nextSurface);
    syncDrawerSurface(nextSurface);
  }, [drawerSurface, isMobileOverlay, setSurface, surface, syncDrawerSurface]);

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
  }, [initialMobileSurface, isMobileOverlay, openNonce, shopId]);

  useEffect(() => {
    return () => {
      if (drawerRafRef.current !== null) {
        cancelAnimationFrame(drawerRafRef.current);
      }
    };
  }, []);

  return {
    isDesktopViewport,
    isMobileOverlay,
    sheetBodyRef,
    drawerSurface,
    drawerHeights,
    lastMainSurfaceRef,
    syncDrawerSurface,
    handleDrawerTouchStart,
    handleDrawerTouchMove,
    handleDrawerTouchEnd,
    handleDrawerHandleClick,
  };
}
