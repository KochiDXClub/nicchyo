"use client";

import React, { createContext, useContext, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import NavigationBar from "./NavigationBar";
import MapLoadingScreen from "./MapLoadingScreen";

type MapLoadingContextValue = {
  isMapLoading: boolean;
  startMapLoading: () => void;
  stopMapLoading: () => void;
  markMapReady: () => void;
};

const MapLoadingContext = createContext<MapLoadingContextValue | null>(null);

const MIN_LOADING_MS = 120;
/** 地図の load が来なくてもここで畳む上限 */
const MAX_LOADING_MS = 8000;

export function useMapLoading() {
  const value = useContext(MapLoadingContext);
  if (!value) {
    throw new Error("useMapLoading must be used within MapLoadingProvider");
  }
  return value;
}

export default function MapLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const pathname = usePathname();
  const startedAtRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const scheduleStop = useCallback(() => {
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (!isMapLoading) return;
    const startedAt = startedAtRef.current ?? Date.now();
    const elapsed = Date.now() - startedAt;
    const remaining = Math.max(MIN_LOADING_MS - elapsed, 0);
    stopTimerRef.current = window.setTimeout(() => {
      setIsMapLoading(false);
      setIsMapReady(false);
      startedAtRef.current = null;
      stopTimerRef.current = null;
    }, remaining);
  }, [isMapLoading]);

  useEffect(() => {
    if (!isMapLoading) return;
    if (isMapReady) {
      scheduleStop();
    }
  }, [isMapLoading, isMapReady, scheduleStop]);

  useEffect(() => {
    if (!isMapLoading) return;
    if (pathname && !pathname.startsWith("/map")) {
      scheduleStop();
    }
  }, [pathname, isMapLoading, scheduleStop]);

  // 保険。markMapReady の呼び出し元は地図の load イベントだけなので、
  // WebGL の初期化に失敗したりタブが裏に回って描画が止まったりすると load が来ず、
  // ローディングが解除されないまま残る。上限を過ぎたら地図を待たずに畳む。
  useEffect(() => {
    if (!isMapLoading) return;
    const timer = window.setTimeout(() => setIsMapReady(true), MAX_LOADING_MS);
    return () => window.clearTimeout(timer);
  }, [isMapLoading]);

  const value = useMemo(
    () => ({
      isMapLoading,
      startMapLoading: () => {
        if (pathname?.startsWith("/map")) return;
        if (stopTimerRef.current !== null) {
          window.clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        startedAtRef.current = Date.now();
        setIsMapReady(false);
        setIsMapLoading(true);
      },
      stopMapLoading: () => {
        setIsMapReady(true);
        scheduleStop();
      },
      markMapReady: () => {
        setIsMapReady(true);
        scheduleStop();
      },
    }),
    [isMapLoading, pathname, scheduleStop]
  );

  return (
    <MapLoadingContext.Provider value={value}>
      {children}
      {isMapLoading && <MapLoadingOverlay />}
    </MapLoadingContext.Provider>
  );
}

function MapLoadingOverlay() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-gradient-to-b from-amber-50 via-orange-50 to-white text-gray-800">
      <div className="flex flex-1 items-center justify-center">
        <MapLoadingScreen />
      </div>
      <NavigationBar activeHref="/map" />
    </div>
  );
}
