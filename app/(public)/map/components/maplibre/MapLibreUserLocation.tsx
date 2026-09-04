"use client";

/**
 * MapLibre 版の現在地マーカー
 *
 * Leaflet 版 UserLocationMarker と同じ判定（精度しきい値・更新間隔・道への投影・
 * 道から離れたら非表示）を、HTML マーカー（maplibregl.Marker）で描く。
 * - 初回の位置取得でその場所へ寄る（suppressInitialFocus のときは寄らない）
 * - 追従（isTracking）中は位置更新のたびに中心を合わせる
 * - 端末の向き（deviceorientation）を矢印で示す。地図の回転（bearing）ぶんは差し引く
 */

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { MapRouteConfig, MapRoutePoint } from "../../types/mapRoute";
import {
  getDefaultMapRouteConfig,
  getDefaultMapRoutePoints,
  getRouteSegments,
  normalizeMapRoutePoints,
  projectPointOntoSegments,
} from "../../utils/mapRouteGeometry";

const MARKET_CENTER: [number, number] = [33.5614118, 133.5379706];

const UPDATE_INTERVAL_IN_MARKET_MS = 1000;
const UPDATE_INTERVAL_OUTSIDE_MS = 15000;
const ANIMATION_MS = 300;
// 精度の閾値（メートル）- これより大きい場合は再取得を待つ
const ACCURACY_THRESHOLD_METERS = 15;
// 精度が悪い状態が続いた場合のフォールバック時間（ミリ秒）
const ACCURACY_FALLBACK_MS = 5000;
// 初回位置取得時のズームレベル（Leaflet 換算。呼び出し側で zoomOffset を足す）
const INITIAL_ZOOM_LEVEL = 19;

const MARKER_HTML = `
<div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
  <div class="user-heading-arrow" style="
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%233b82f6%22><path d=%22M12 2L2 22l10-3 10 3L12 2z%22/></svg>');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    transform-origin: center center;
    transition: transform 0.1s linear;
    opacity: 0.3;
  "></div>
  <div style="
    width: 16px;
    height: 16px;
    background-color: #2563eb;
    border: 3px solid white;
    border-radius: 50%;
    z-index: 10;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  "></div>
</div>`;

const POPUP_HTML = `
<div style="text-align: center; font-family: sans-serif;">
  <div style="font-size: 24px; margin-bottom: 8px;">📍</div>
  <strong style="font-size: 14px;">現在地</strong>
</div>`;

interface MapLibreUserLocationProps {
  map: maplibregl.Map | null;
  /** MapLibre のズームは Leaflet より 1 小さいので、Leaflet 換算の値に足す量 */
  zoomOffset: number;
  onLocationUpdate?: (isInMarket: boolean, position: [number, number]) => void;
  isTracking?: boolean;
  suppressInitialFocus?: boolean;
  routePoints?: MapRoutePoint[];
  routeConfig?: MapRouteConfig;
}

export default function MapLibreUserLocation({
  map,
  zoomOffset,
  onLocationUpdate,
  isTracking,
  suppressInitialFocus = false,
  routePoints,
  routeConfig,
}: MapLibreUserLocationProps) {
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const arrowRef = useRef<HTMLDivElement | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const onLocationUpdateRef = useRef(onLocationUpdate);
  const isTrackingRef = useRef(isTracking);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  // 追従をオンにしたら、その場で現在地へ寄せる
  useEffect(() => {
    isTrackingRef.current = isTracking;
    if (isTracking && map && markerRef.current) {
      map.easeTo({ center: markerRef.current.getLngLat(), duration: 500 });
    }
  }, [isTracking, map]);

  // 端末の向き → 矢印。地図の回転ぶんを差し引いて画面上の向きにする
  useEffect(() => {
    if (!map) return;
    const applyHeading = () => {
      const heading = lastHeadingRef.current;
      if (heading === null || !arrowRef.current) return;
      arrowRef.current.style.transform = `rotate(${heading - map.getBearing()}deg)`;
      arrowRef.current.style.opacity = "1";
    };
    const handleOrientation = (event: DeviceOrientationEvent) => {
      const webkitHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      let heading: number | null = null;
      if (webkitHeading) heading = webkitHeading;
      else if (event.alpha !== null) heading = 360 - event.alpha;
      if (heading === null) return;
      lastHeadingRef.current = heading;
      applyHeading();
    };
    window.addEventListener("deviceorientation", handleOrientation);
    map.on("rotate", applyHeading);
    return () => {
      window.removeEventListener("deviceorientation", handleOrientation);
      map.off("rotate", applyHeading);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const activeRoutePoints = normalizeMapRoutePoints(routePoints ?? []);
    const effectiveRoutePoints = activeRoutePoints.length >= 2 ? activeRoutePoints : getDefaultMapRoutePoints();
    const effectiveRouteConfig = { ...getDefaultMapRouteConfig(), ...(routeConfig ?? {}) };
    const routeSegments = getRouteSegments(effectiveRoutePoints);

    let lastUpdate = 0;
    let lowAccuracyStart: number | null = null;
    let isFirstLocation = true;
    let routeVisible = false;

    const removeMarker = () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      markerRef.current?.remove();
      markerRef.current = null;
      arrowRef.current = null;
    };

    const animateMarkerTo = (target: [number, number]) => {
      const marker = markerRef.current;
      if (!marker) return;
      const from = marker.getLngLat();
      const start = performance.now();
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      const step = (ts: number) => {
        if (!markerRef.current) return;
        const progress = Math.min(1, (ts - start) / ANIMATION_MS);
        markerRef.current.setLngLat([
          from.lng + (target[1] - from.lng) * progress,
          from.lat + (target[0] - from.lat) * progress,
        ]);
        animFrameRef.current = progress < 1 ? requestAnimationFrame(step) : null;
      };
      animFrameRef.current = requestAnimationFrame(step);
    };

    const setupMarker = (position: [number, number]) => {
      const el = document.createElement("div");
      el.className = "user-location-marker-container";
      el.innerHTML = MARKER_HTML;
      el.style.zIndex = "3";
      arrowRef.current = el.querySelector<HTMLDivElement>(".user-heading-arrow");
      if (arrowRef.current && lastHeadingRef.current !== null) {
        arrowRef.current.style.transform = `rotate(${lastHeadingRef.current - map.getBearing()}deg)`;
        arrowRef.current.style.opacity = "1";
      }
      return new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([position[1], position[0]])
        .setPopup(new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(POPUP_HTML))
        .addTo(map);
    };

    if (!("geolocation" in navigator)) {
      console.warn("Geolocation is not supported by this browser");
      removeMarker();
      onLocationUpdateRef.current?.(false, MARKET_CENTER);
      return () => removeMarker();
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const projected = projectPointOntoSegments(
          { lat: latitude, lng: longitude },
          effectiveRoutePoints,
          routeSegments
        );
        const distanceFromRoute = projected?.distanceMeters ?? Number.POSITIVE_INFINITY;
        const canSnap = distanceFromRoute <= effectiveRouteConfig.snapDistanceMeters;
        const canStayVisible = distanceFromRoute <= effectiveRouteConfig.visibleDistanceMeters;
        const shouldShowOnRoute = canSnap || (routeVisible && canStayVisible);
        const inMarket = shouldShowOnRoute && projected !== null;
        const now = Date.now();
        const interval = inMarket ? UPDATE_INTERVAL_IN_MARKET_MS : UPDATE_INTERVAL_OUTSIDE_MS;
        if (markerRef.current && now - lastUpdate < interval) return;

        // 精度チェック：閾値より大きい場合は再取得を待つ（一定時間続いたら妥協して更新）
        if (accuracy > ACCURACY_THRESHOLD_METERS) {
          if (lowAccuracyStart === null) lowAccuracyStart = now;
          const shouldFallback = now - lowAccuracyStart >= ACCURACY_FALLBACK_MS;
          if (markerRef.current && !shouldFallback) return;
        } else {
          lowAccuracyStart = null;
        }
        lastUpdate = now;

        if (!inMarket || !projected) {
          routeVisible = false;
          removeMarker();
          onLocationUpdateRef.current?.(false, [latitude, longitude]);
          return;
        }
        routeVisible = true;
        const displayPosition: [number, number] = [projected.point.lat, projected.point.lng];
        const center: [number, number] = [displayPosition[1], displayPosition[0]];

        if (isFirstLocation) {
          isFirstLocation = false;
          if (!suppressInitialFocus) {
            map.flyTo({ center, zoom: INITIAL_ZOOM_LEVEL + zoomOffset, duration: 1000 });
          }
        } else if (isTrackingRef.current) {
          map.easeTo({ center, duration: 500 });
        }

        if (markerRef.current) animateMarkerTo(displayPosition);
        else markerRef.current = setupMarker(displayPosition);

        onLocationUpdateRef.current?.(true, displayPosition);
      },
      (error) => {
        console.warn("Failed to get geolocation", error);
        removeMarker();
        onLocationUpdateRef.current?.(false, MARKET_CENTER);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      removeMarker();
    };
  }, [map, routeConfig, routePoints, suppressInitialFocus, zoomOffset]);

  return null;
}
