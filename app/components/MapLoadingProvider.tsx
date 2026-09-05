"use client";

import React, { createContext, useContext, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import MapLoadingOverlay from "./MapLoadingOverlay";

/**
 * マップ読み込みの段階。順に進み、戻らない。
 *
 * - navigating: /map へのリンクを押した（RSC 取得中）
 * - page:       マップページの部品が画面に乗った
 * - style:      地図ライブラリがスタイルを読み終えた（MapLibre のみ）
 * - loaded:     地図の load が来た（道・店の層を載せ終えた）
 * - ready:      タイルやグリフまで描き終えた
 */
export type MapLoadStage = "navigating" | "page" | "style" | "loaded" | "ready";

const STAGE_ORDER: MapLoadStage[] = ["navigating", "page", "style", "loaded", "ready"];

/** 段階ごとの進み具合（ゲージと点の灯りが共有する値） */
export const MAP_LOAD_PROGRESS: Record<MapLoadStage, number> = {
  navigating: 0.08,
  page: 0.3,
  style: 0.55,
  loaded: 0.8,
  ready: 1,
};

export function laterStage(a: MapLoadStage, b: MapLoadStage): MapLoadStage {
  return STAGE_ORDER.indexOf(a) >= STAGE_ORDER.indexOf(b) ? a : b;
}

type MapLoadingStatus = "idle" | "loading" | "leaving";

type MapLoadingState = {
  status: MapLoadingStatus;
  stage: MapLoadStage;
};

type MapLoadingContextValue = {
  status: MapLoadingStatus;
  stage: MapLoadStage;
  isMapLoading: boolean;
  /** /map 以外から /map へ向かい始めた（リンク押下や router.push の直前に呼ぶ） */
  startMapLoading: () => void;
  /** マップページが画面に乗った。以後は Provider のオーバーレイが地図の完成まで残る */
  takeOverMapLoading: () => void;
  /** 地図側から段階を報告する。ready で畳み始める */
  reportMapStage: (stage: MapLoadStage) => void;
  markMapReady: () => void;
  stopMapLoading: () => void;
};

const MapLoadingContext = createContext<MapLoadingContextValue | null>(null);

const IDLE_STATE: MapLoadingState = { status: "idle", stage: "navigating" };

/** 一瞬で終わってもチラつかないための最短表示時間 */
const MIN_LOADING_MS = 120;
/** 到着演出（オーバーレイが開ける）の長さ。globals.css の .map-loading-overlay の transition と揃える */
const LEAVE_MS = 520;
/** 地図の ready が来なくてもここで畳む上限 */
const MAX_LOADING_MS = 8000;

export function useMapLoading() {
  const value = useContext(MapLoadingContext);
  if (!value) {
    throw new Error("useMapLoading must be used within MapLoadingProvider");
  }
  return value;
}

export default function MapLoadingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MapLoadingState>(IDLE_STATE);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const statusRef = useRef<MapLoadingStatus>("idle");
  statusRef.current = state.status;
  const startedAtRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const leaveTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
      finishTimerRef.current = null;
    }
    if (leaveTimerRef.current !== null) {
      window.clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearTimers();
    startedAtRef.current = null;
    setState(IDLE_STATE);
  }, [clearTimers]);

  /** ready になったら最短表示時間を守ってから到着演出に入り、演出が終わったら片付ける */
  const finish = useCallback(() => {
    if (statusRef.current !== "loading") return;
    if (finishTimerRef.current !== null) return;
    const startedAt = startedAtRef.current ?? Date.now();
    const remaining = Math.max(MIN_LOADING_MS - (Date.now() - startedAt), 0);
    finishTimerRef.current = window.setTimeout(() => {
      finishTimerRef.current = null;
      setState((prev) => (prev.status === "loading" ? { ...prev, status: "leaving", stage: "ready" } : prev));
      leaveTimerRef.current = window.setTimeout(() => {
        leaveTimerRef.current = null;
        startedAtRef.current = null;
        setState(IDLE_STATE);
      }, LEAVE_MS);
    }, remaining);
  }, []);

  const startMapLoading = useCallback(() => {
    if (pathnameRef.current?.startsWith("/map")) return;
    if (statusRef.current === "loading") return;
    clearTimers();
    startedAtRef.current = Date.now();
    setState({ status: "loading", stage: "navigating" });
  }, [clearTimers]);

  const takeOverMapLoading = useCallback(() => {
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    setState((prev) => {
      if (prev.status === "leaving") return prev;
      return { status: "loading", stage: laterStage(prev.stage, "page") };
    });
  }, []);

  const reportMapStage = useCallback(
    (stage: MapLoadStage) => {
      setState((prev) => (prev.status === "loading" ? { ...prev, stage: laterStage(prev.stage, stage) } : prev));
      if (stage === "ready") finish();
    },
    [finish]
  );

  const markMapReady = useCallback(() => reportMapStage("ready"), [reportMapStage]);

  // /map 以外へ行ったら、途中でも畳む
  useEffect(() => {
    if (state.status === "idle") return;
    if (pathname && !pathname.startsWith("/map")) reset();
  }, [pathname, state.status, reset]);

  // 保険。WebGL の初期化に失敗したり、タブが裏に回って描画が止まると ready が来ず、
  // ローディングが解除されないまま残る。上限を過ぎたら地図を待たずに畳む。
  useEffect(() => {
    if (state.status !== "loading") return;
    const timer = window.setTimeout(finish, MAX_LOADING_MS);
    return () => window.clearTimeout(timer);
  }, [state.status, finish]);

  // /map へ向かうリンクはどこにあっても拾う（NavigationBar や各ページの素の Link を含む）。
  // React のハンドラは root で処理されるので、document のバブリングで見れば preventDefault 済みかが分かる
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!url.pathname.startsWith("/map")) return;
      startMapLoading();
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [startMapLoading]);

  useEffect(() => clearTimers, [clearTimers]);

  const value = useMemo<MapLoadingContextValue>(
    () => ({
      status: state.status,
      stage: state.stage,
      isMapLoading: state.status !== "idle",
      startMapLoading,
      takeOverMapLoading,
      reportMapStage,
      markMapReady,
      stopMapLoading: markMapReady,
    }),
    [state.status, state.stage, startMapLoading, takeOverMapLoading, reportMapStage, markMapReady]
  );

  return (
    <MapLoadingContext.Provider value={value}>
      {children}
      {/* ページの Suspense 境界の外にあるので、地図チャンクの遅延読み込みで
          ページ側が一時的に外れても、このオーバーレイは残る */}
      {state.status !== "idle" && <MapLoadingOverlay leaving={state.status === "leaving"} />}
    </MapLoadingContext.Provider>
  );
}
