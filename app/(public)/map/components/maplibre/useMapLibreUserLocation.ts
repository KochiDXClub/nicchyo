"use client";

/**
 * MapLibre 版の現在地表示
 *
 * 測位・青い点・精度の円・追従・「地図を動かしたら追従をやめる」は
 * MapLibre 標準の GeolocateControl に任せる。
 * - 点は位置情報が取れている間ずっと出す。追従ボタンは「画面の真ん中に追い続けるか」だけを切り替える
 * - 標準のボタンは隠し、共用の追従ボタン（MapControls）から操作する
 * - 追従中かどうかは control のイベントから受け取る（状態は control が持つ）
 * - 「市場の中にいるか」だけは道への距離から判定して親へ知らせる
 * - 可動範囲（maxBounds）の外にいるときは control が点を消す
 *
 * GeolocateControl の状態は「オフ → 追従（ACTIVE_LOCK）→ 背景（BACKGROUND）」で、
 * 追従から背景へ移るのは「ユーザーが地図を動かしたとき」だけ（API では移れない）。
 * ボタンで追従をやめるときは、その場で長さゼロの移動を起こしてこの経路に乗せる。
 * 標準ボタンの「追従中に押すとオフ」は使わない（点まで消えてしまうため）。
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
  /** true なら最初の位置取得で現在地に寄らない（施設に合わせた画角を崩さないため）。点は出す */
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
  const isTrackingRef = useRef(false);
  // 次の位置取得が来たら追従を外す（最初の寄せを抑える・位置が来る前に追従を切られた）
  const releaseOnNextFixRef = useRef(false);
  const hasFixRef = useRef(false);
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
    // 追従（ACTIVE_LOCK）から背景（BACKGROUND）へ。control はユーザー起点の movestart でだけ背景に移るので、
    // 進行中のアニメーションを止めてから、その場で長さゼロの移動を起こす（見た目は動かない）
    const releaseFollow = () => {
      map.stop();
      map.easeTo({ center: map.getCenter(), duration: 0 });
    };
    const handleGeolocate = (event: { coords: GeolocationCoordinates }) => {
      hasFixRef.current = true;
      if (releaseOnNextFixRef.current) {
        releaseOnNextFixRef.current = false;
        // control が始めた寄せ（fitBounds）を最初のフレームが出る前に止める
        releaseFollow();
      }
      reportInMarket(event.coords);
    };
    const handleOutOfBounds = (event: { coords: GeolocationCoordinates }) => {
      inMarketRef.current = false;
      onLocationUpdateRef.current?.(false, [event.coords.latitude, event.coords.longitude]);
    };
    const handleError = (event: { code: number; message: string }) => {
      console.warn("Failed to get geolocation", event.code, event.message);
      inMarketRef.current = false;
      onLocationUpdateRef.current?.(false, MARKET_CENTER);
    };
    const handleTrackStart = () => {
      // 最初の位置で追従を外す予定なら、ボタンを一瞬だけ点灯させない
      if (releaseOnNextFixRef.current) return;
      isTrackingRef.current = true;
      setIsTracking(true);
    };
    const handleTrackEnd = () => {
      isTrackingRef.current = false;
      setIsTracking(false);
    };

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
      isTrackingRef.current = false;
      releaseOnNextFixRef.current = false;
      hasFixRef.current = false;
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

  // ローディングが畳まれてから、こちらから測位を始める（Leaflet 版と同じく最初は追従オン）。
  // 画角を守りたいとき（おでかけサポート中など）は、点は出すが最初の寄せはせず背景に落とす
  useEffect(() => {
    if (!map || !canAskLocation || autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;
    releaseOnNextFixRef.current = suppressInitialFocus;
    trigger();
  }, [map, canAskLocation, suppressInitialFocus, trigger]);

  // 追従ボタン。「画面の真ん中に追い続けるか」だけを切り替え、点は消さない
  const toggleTracking = useCallback(() => {
    const control = controlRef.current;
    if (!control || !map) return;
    setRequested(true);
    autoTriggeredRef.current = true;
    if (!isTrackingRef.current) {
      if (!hasFixRef.current && releaseOnNextFixRef.current) {
        // 最初の位置を待つ間に外していた追従を戻す（control はまだ待機中なので trigger しない）
        releaseOnNextFixRef.current = false;
        isTrackingRef.current = true;
        setIsTracking(true);
        return;
      }
      // 背景 → 追従（最後の位置へ寄る）。まだ始めていなければ測位を始める
      trigger();
      return;
    }
    if (!hasFixRef.current) {
      // 最初の位置がまだ来ていない。来た時点で追従を外す
      releaseOnNextFixRef.current = true;
      isTrackingRef.current = false;
      setIsTracking(false);
      return;
    }
    map.stop();
    map.easeTo({ center: map.getCenter(), duration: 0 });
  }, [map, trigger]);

  return { isTracking, toggleTracking };
}
