"use client";

/**
 * MapLibre 版の現在地表示
 *
 * 測位・青い点・精度の円・追従・「地図を動かしたら追従をやめる」は
 * MapLibre 標準の GeolocateControl に任せる。
 * - 標準のボタンは隠し、共用の追従ボタン（MapControls）から trigger() で操作する
 * - 追従中かどうかは control のイベントから受け取る（状態は control が持つ）
 * - 「市場の中にいるか」だけは道への距離から判定して親へ知らせる
 * - 可動範囲（maxBounds）の外にいるときは control が点を消す
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";

import { useLocationPermissionGate } from "../../hooks/useLocationPermissionGate";
import type { MapRouteConfig, MapRoutePoint } from "../../types/mapRoute";
import {
  getDefaultMapRouteConfig,
  getDefaultMapRoutePoints,
  getRouteSegments,
  normalizeMapRoutePoints,
  projectPointOntoSegments,
} from "../../utils/mapRouteGeometry";

const MARKET_CENTER: [number, number] = [33.5614118, 133.5379706];

// 現在地へ寄るときの上限ズーム（Leaflet 換算。呼び出し側の zoomOffset を足す）
const INITIAL_ZOOM_LEVEL = 19;
// control の準備（Geolocation API の有無の確認）は非同期なので、ボタンが有効になるまで待って trigger する
const TRIGGER_RETRY_MS = 100;
const TRIGGER_RETRY_MAX = 50;

interface RouteGeometry {
  points: MapRoutePoint[];
  segments: ReturnType<typeof getRouteSegments>;
  snapDistanceMeters: number;
  visibleDistanceMeters: number;
}

function buildRouteGeometry(routePoints?: MapRoutePoint[], routeConfig?: MapRouteConfig): RouteGeometry {
  const normalized = normalizeMapRoutePoints(routePoints ?? []);
  const points = normalized.length >= 2 ? normalized : getDefaultMapRoutePoints();
  const config = { ...getDefaultMapRouteConfig(), ...(routeConfig ?? {}) };
  return {
    points,
    segments: getRouteSegments(points),
    snapDistanceMeters: config.snapDistanceMeters,
    visibleDistanceMeters: config.visibleDistanceMeters,
  };
}

interface UseMapLibreUserLocationOptions {
  map: maplibregl.Map | null;
  /** MapLibre のズームは Leaflet より 1 小さいので、Leaflet 換算の値に足す量 */
  zoomOffset: number;
  onLocationUpdate?: (isInMarket: boolean, position: [number, number]) => void;
  /** true の間はこちらから測位を始めない（施設に合わせた画角を現在地の自動ズームで崩さないため） */
  suppressInitialFocus?: boolean;
  routePoints?: MapRoutePoint[];
  routeConfig?: MapRouteConfig;
}

export function useMapLibreUserLocation({
  map,
  zoomOffset,
  onLocationUpdate,
  suppressInitialFocus = false,
  routePoints,
  routeConfig,
}: UseMapLibreUserLocationOptions) {
  const controlRef = useRef<maplibregl.GeolocateControl | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const autoTriggeredRef = useRef(false);
  const inMarketRef = useRef(false);
  const routeRef = useRef<RouteGeometry>(buildRouteGeometry(routePoints, routeConfig));
  const onLocationUpdateRef = useRef(onLocationUpdate);
  const [isTracking, setIsTracking] = useState(false);
  // 追従ボタンを押されたのは「ご自分から現在地を求められた」ということなので待たせない
  const [requested, setRequested] = useState(false);
  const canAskLocation = useLocationPermissionGate(requested);

  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  useEffect(() => {
    routeRef.current = buildRouteGeometry(routePoints, routeConfig);
  }, [routePoints, routeConfig]);

  // control をマップに載せる
  useEffect(() => {
    if (!map) return;

    const control = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      // 精度の円が収まる範囲に寄せる。既定の maxZoom は 15 で市場には遠すぎる
      fitBoundsOptions: { maxZoom: INITIAL_ZOOM_LEVEL + zoomOffset, linear: true, duration: 500 },
      trackUserLocation: true,
      showUserLocation: true,
      showAccuracyCircle: true,
    });

    const reportInMarket = (coords: GeolocationCoordinates) => {
      const route = routeRef.current;
      const projected = projectPointOntoSegments(
        { lat: coords.latitude, lng: coords.longitude },
        route.points,
        route.segments
      );
      const distance = projected?.distanceMeters ?? Number.POSITIVE_INFINITY;
      // 道の近くで「市場の中」に入り、少し離れるまでは「中」のまま（境界で点滅させない）
      const inMarket =
        distance <= route.snapDistanceMeters || (inMarketRef.current && distance <= route.visibleDistanceMeters);
      inMarketRef.current = inMarket;
      onLocationUpdateRef.current?.(inMarket, [coords.latitude, coords.longitude]);
    };
    const handleGeolocate = (event: { coords: GeolocationCoordinates }) => reportInMarket(event.coords);
    const handleOutOfBounds = (event: { coords: GeolocationCoordinates }) => {
      inMarketRef.current = false;
      onLocationUpdateRef.current?.(false, [event.coords.latitude, event.coords.longitude]);
    };
    const handleError = (event: { code: number; message: string }) => {
      console.warn("Failed to get geolocation", event.code, event.message);
      inMarketRef.current = false;
      onLocationUpdateRef.current?.(false, MARKET_CENTER);
    };
    const handleTrackStart = () => setIsTracking(true);
    const handleTrackEnd = () => setIsTracking(false);

    control.on("geolocate", handleGeolocate);
    control.on("outofmaxbounds", handleOutOfBounds);
    control.on("error", handleError);
    control.on("trackuserlocationstart", handleTrackStart);
    control.on("trackuserlocationend", handleTrackEnd);

    map.addControl(control, "bottom-right");
    // 標準のボタンは出さない（追従ボタンは MapControls のものを使う）
    const group = map
      .getContainer()
      .querySelector<HTMLElement>(".maplibregl-ctrl-geolocate")
      ?.closest<HTMLElement>(".maplibregl-ctrl-group");
    if (group) group.style.display = "none";

    controlRef.current = control;

    return () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      control.off("geolocate", handleGeolocate);
      control.off("outofmaxbounds", handleOutOfBounds);
      control.off("error", handleError);
      control.off("trackuserlocationstart", handleTrackStart);
      control.off("trackuserlocationend", handleTrackEnd);
      if (map.hasControl(control)) map.removeControl(control);
      controlRef.current = null;
      autoTriggeredRef.current = false;
      inMarketRef.current = false;
      setIsTracking(false);
    };
  }, [map, zoomOffset]);

  // control の準備が終わってから trigger する。Geolocation API が無い端末では準備が終わらないので諦める
  const trigger = useCallback(() => {
    const control = controlRef.current;
    if (!control || !map) return;
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    let tries = 0;
    const attempt = () => {
      retryTimerRef.current = null;
      if (controlRef.current !== control) return;
      const button = map.getContainer().querySelector<HTMLButtonElement>(".maplibregl-ctrl-geolocate");
      if (button && !button.disabled) {
        control.trigger();
        return;
      }
      if (++tries >= TRIGGER_RETRY_MAX) {
        console.warn("Geolocation is not supported by this browser");
        onLocationUpdateRef.current?.(false, MARKET_CENTER);
        return;
      }
      retryTimerRef.current = window.setTimeout(attempt, TRIGGER_RETRY_MS);
    };
    attempt();
  }, [map]);

  // ローディングが畳まれてから、こちらから測位を始める（Leaflet 版と同じく最初は追従オン）
  useEffect(() => {
    if (!map || !canAskLocation || suppressInitialFocus || autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    trigger();
  }, [map, canAskLocation, suppressInitialFocus, trigger]);

  // 追従ボタン。control の状態遷移（オフ → 追従 → オフ、待機 → 追従）に従う
  const toggleTracking = useCallback(() => {
    setRequested(true);
    autoTriggeredRef.current = true;
    trigger();
  }, [trigger]);

  return { isTracking, toggleTracking };
}
