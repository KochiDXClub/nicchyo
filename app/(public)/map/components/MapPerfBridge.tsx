"use client";

/**
 * 計測用の橋渡し
 *
 * URL に `?perf=1` が付いているときだけ、Leaflet の Map インスタンスを
 * window.__nicchyoMapBench に公開する。管理画面 /admin/map-perf が
 * 同一オリジンの iframe 越しにこれを呼んでベンチマークを走らせる。
 *
 * 通常の来訪者には何も影響しない（フラグが無ければ何もしない）。
 */

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import {
  runFullBenchmark,
  collectDomStats,
  type BenchmarkProgress,
  type BenchmarkReport,
  type DomStats,
} from "@/lib/perf/mapBenchmark";

export interface NicchyoMapBench {
  run: (onProgress?: BenchmarkProgress) => Promise<BenchmarkReport>;
  domStats: () => DomStats;
  /** プロファイル取得などで個別にズームさせたいときに使う */
  zoomTo: (zoom: number) => void;
  getZoom: () => number;
}

declare global {
  interface Window {
    __nicchyoMapBench?: NicchyoMapBench;
  }
}

export default function MapPerfBridge() {
  const map = useMap();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("perf") !== "1") return;

    window.__nicchyoMapBench = {
      run: (onProgress) => runFullBenchmark(map, onProgress),
      domStats: () => collectDomStats(map),
      zoomTo: (zoom) => {
        map.setZoom(zoom, { animate: true });
      },
      getZoom: () => map.getZoom(),
    };
    window.dispatchEvent(new Event("nicchyo-map-bench-ready"));

    return () => {
      delete window.__nicchyoMapBench;
    };
  }, [map]);

  return null;
}
