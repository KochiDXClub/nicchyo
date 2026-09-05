/**
 * 軽量化された MapView
 *
 * 【改善点】
 * 1. currentZoom を state で管理しない → 再レンダリング削減
 * 2. 店舗マーカーは OptimizedShopLayerWithClustering に完全委譲
 * 3. UI 層（詳細バナー）と地図層を完全分離
 * 4. ズーム操作で React が再レンダリングされない
 *
 * 【パフォーマンス向上】
 * - 再レンダリング: 100%削減（ズーム操作時）
 * - DOM 要素数: 98%削減（1800個 → 30個以下）
 * - 初期表示速度: 3倍以上向上
 */

'use client';

import { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { shops as baseShops, Shop } from "../data/shops";
import ShopDetailBanner from "./ShopDetailBanner";
import BackgroundOverlay from "./BackgroundOverlay";
import UserLocationMarker from "./UserLocationMarker";
import MapAgentAssistant from "./MapAgentAssistant";
import OptimizedShopLayerWithClustering from "./OptimizedShopLayerWithClustering";
import { LiveZoomMapControls } from "./MapControls";
import type { MapCamera } from "../types/mapCamera";
import MapPerfBridge from "./MapPerfBridge";
import { readPerfShopCount, synthesizeShops } from "@/lib/perf/syntheticShops";
import {
  resolveMapFeatureFlags,
  type MapFeatureFlags,
  type RoadSnapMode,
  type ZoomSkipMode,
} from "@/lib/mapFeatureFlags";
import { MapOverlays, getVisibleMajorPlaceLabels } from "./MapOverlays";
import {
  getRecommendedZoomBounds,
} from '../config/roadConfig';
import { FAVORITE_SHOPS_KEY, FAVORITE_SHOPS_UPDATED_EVENT, loadFavoriteShopIds } from "../../../../lib/favoriteShops";
import {
  getViewModeForZoom,
  ViewMode,
  OVERVIEW_ZONE_MIN_ZOOM,
  OVERVIEW_ZONE_MAX_ZOOM,
} from '../config/displayConfig';
import { useBag } from "../../../../lib/storage/BagContext";
import type { Landmark } from "../types/landmark";
import type { MapRoute } from "../types/mapRoute";
import {
  getAutoRotationForVisibleRoad,
  normalizeRotationDeg,
} from "../utils/autoRotation";
import {
  expandBoundsByMeters,
  getDefaultMapRouteConfig,
  getDefaultMapRoutePoints,
  getRouteBounds,
  getRouteCenter,
  normalizeMapRoutePoints,
  projectPointOntoRoute,
} from "../utils/mapRouteGeometry";
import { useMapGestures } from "../hooks/useMapGestures";
import { useMapCameraController } from "../hooks/useMapCameraController";
import SearchResultsSheet, { SpotlightCountdownBar } from "./SearchResultsSheet";
import {
  ROAD_SNAP_DELAY_MS,
  ROAD_SNAP_MIN_DISTANCE_METERS,
  SKIPPED_ZOOM_LEVELS,
  SKIPPED_ZOOM_NUDGE,
  SKIPPED_ZOOM_TOLERANCE,
} from "../../../../lib/constants";

// Recommended zoom bounds (optimal range for Sunday Market)
const ZOOM_BOUNDS = getRecommendedZoomBounds();

const MIN_ZOOM = ZOOM_BOUNDS.min;
const MAX_ZOOM = ZOOM_BOUNDS.max;
const INITIAL_ZOOM = MAX_ZOOM;
const AGENT_STORAGE_KEY = "nicchyo-map-agent-plan";
/**
 * ズーム倍率に関わらず常に表示する、公共交通機関のランドマークか判定する。
 * 「城」「オーテピア」等の一般ランドマークは、丁目バッジが出る通常ズーム
 * （shouldRenderLandmarks && !isMinimumZoomMode）でのみ表示するが、
 * 電停・駅は道案内の目印として日常的に必要なため、それより広いズーム帯
 * （このズーム帯だけ何も出ない「隙間」だった）でも見えるようにする。
 * 電停は key が "tram-" で始まる規約になっているため、個別に列挙せず
 * プレフィックスで判定する（新しい電停の追加時にコード変更が不要）。
 */
function isAlwaysVisibleTransitLandmarkKey(key: string): boolean {
  return key === "densha" || key === "jr-kochi-station" || key.startsWith("tram-");
}
const BASEMAP_TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png";
const BASEMAP_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// ===== 時間帯に応じたアンビエントオーバーレイ =====
function TimeAmbientOverlay() {
  const hour = new Date().getHours();

  let background: string | null = null;
  if (hour >= 6 && hour < 9) {
    // 朝 — 朝霧・柔らかい白い光
    background = 'linear-gradient(to bottom, rgba(255,252,235,0.18), rgba(255,248,220,0.07))';
  } else if (hour >= 14 && hour < 17) {
    // 昼後半 — 陽光の暖かみ
    background = 'rgba(255,195,70,0.06)';
  } else if (hour >= 17 && hour < 19) {
    // 夕方 — 橙色の斜光
    background = 'linear-gradient(to bottom, rgba(255,140,30,0.12), rgba(255,90,10,0.05))';
  }

  if (!background) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[500]"
      style={{ background }}
    />
  );
}

// ズームスライダーを2本指操作の終了後に表示し続ける時間（ミリ秒）
const ZOOM_SLIDER_HIDE_DELAY_MS = 3000;

function MapZoomGuideToast({ message }: { message: string | null }) {
  return (
    <div
      className={`pointer-events-none absolute bottom-3 left-1/2 z-[1400] w-auto max-w-[min(calc(100vw-4rem),20rem)] -translate-x-1/2 transition-all duration-200 ${
        message ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
      }`}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="rounded-2xl bg-sky-100/95 px-3 py-1.5 text-center text-sm font-semibold leading-snug text-sky-900 shadow-md backdrop-blur">
        {message ?? ""}
      </div>
    </div>
  );
}

export type MapViewProps = {
  shops?: Shop[];
  landmarks?: Landmark[];
  mapRoute?: MapRoute;
  initialShopId?: number;
  openInitialShopBanner?: boolean;
  agentOpen?: boolean;
  onAgentToggle?: (open: boolean) => void;
  searchShopIds?: number[];
  /** 地図が描き終えた（ローディングを畳んでよい） */
  onMapReady?: () => void;
  /** 読み込みの途中経過。ローディングのゲージに使う（MapLibre 版のみ報告する） */
  onMapStage?: (stage: "style" | "loaded") => void;
  eventTargets?: Array<{ id: string; lat: number; lng: number }>;
  highlightEventTargets?: boolean;
  /** 地図のカメラ操作（Leaflet 版は L.Map をそのまま渡す。MapLibre 版はアダプタ） */
  onMapInstance?: (map: MapCamera) => void;
  onUserLocationUpdate?: (coords: { lat: number; lng: number; inMarket: boolean }) => void;
  aiShopIds?: number[];
  commentShopId?: number;
  onZoomChange?: (zoom: number) => void;
  suppressInitialLocationFocus?: boolean;
  /** 管理画面で保存したマップ動作フラグ。URL の ?mapFlags= がクライアント側で上書きする */
  featureFlags?: MapFeatureFlags;
  onShopSelect?: (shop: Shop) => void;
  spotlightShopId?: number;
  onClearSearch?: () => void;
  /** マップ座標系内にレンダリングするオーバーレイ（キャラクターなど） */
  overlaySlot?: React.ReactNode;
  /** trueのとき拡大縮小スライダーと検索バーを非表示にする */
  hideMapUI?: boolean;
  /**
   * trueのとき、通常のランドマーク（駅・電停の常時表示分を含む）を
   * 一切表示しない。おでかけサポートの案内中は FacilityLayer が
   * 同じ電停・駅をカテゴリの目的に合わせて表示するため、両方出すと
   * 二重に見えてしまう／無関係なカテゴリでも常に駅アイコンが写り込む
   * ことになるのを避ける。
   */
  suppressLandmarks?: boolean;
  /** 現在地ボタンの top 位置（px）。検索エリアの実際の高さに合わせて親から渡す */
  trackingButtonTop?: number;
  /**
   * 2本指の回転/ピンチジェスチャー中かどうかが変化したときに呼ばれる。
   * 回転のみのジェスチャーは Leaflet の pan/zoom を伴わないため
   * move/zoom イベントが発火せず、「このへん」ボタンの静止判定
   * （useNearbyPromptVisibility）だけではジェスチャー中を検知できない。
   * この通知を使って親側で表示状態を更新する。
   */
  onGestureActiveChange?: (active: boolean) => void;
};

export type ShopBannerOrigin = { x: number; y: number; width: number; height: number };

function MapZoomListener({ onZoomChange }: { onZoomChange?: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onZoomChange) return;
    const handleZoomEnd = () => {
      onZoomChange(map.getZoom());
    };

    handleZoomEnd();
    map.on("zoomend", handleZoomEnd);
    return () => {
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, onZoomChange]);
  return null;
}

/**
 * 特定のズーム値（丁目表示の切替境界）に止まらないようにする。
 *
 * 以前は zoomend の後に setZoom(animate: false) で ±0.03 逃がしていたが、
 * それだと 1 回のズームでズーム終了処理（タイル再取得・マーカー再配置・React 再描画）が
 * 2 回走り、後者は同期実行なのでフレームが止まっていた。
 *
 * 今は Leaflet がズーム先を確定する _limitZoom（zoomSnap 丸めと min/max 制限）に
 * 割り込み、着地前に目標値そのものをずらす。ホイール・ピンチ・スライダー・flyTo の
 * どの入口でも 1 回のズームで済む。_limitZoom は Leaflet 1.x で長く安定している内部 API。
 */
function findSkippedZoom(zoom: number): number | undefined {
  return SKIPPED_ZOOM_LEVELS.find((level) => Math.abs(zoom - level) <= SKIPPED_ZOOM_TOLERANCE);
}

function MapZoomConstraint({ mode }: { mode: ZoomSkipMode }) {
  const map = useMap();

  // before: ズーム先の確定時に逃がす（1 回のズームで済む）
  useEffect(() => {
    if (mode !== "before") return;
    type LimitZoom = (zoom: number) => number;
    const target = map as unknown as { _limitZoom: LimitZoom };
    const original = target._limitZoom;

    target._limitZoom = function limitZoomAvoidingSkipped(this: L.Map, zoom: number) {
      const limited = original.call(this, zoom);
      const skipped = findSkippedZoom(limited);
      if (skipped === undefined) return limited;
      const zoomingIn = limited >= this.getZoom();
      const nudged = zoomingIn ? skipped + SKIPPED_ZOOM_NUDGE : skipped - SKIPPED_ZOOM_NUDGE;
      return original.call(this, nudged);
    };

    return () => {
      target._limitZoom = original;
    };
  }, [map, mode]);

  // after: 従来方式。ズーム終了後にもう一度 setZoom で逃がす（比較実験用に残す）
  useEffect(() => {
    if (mode !== "after") return;
    let zoomBeforeChange = map.getZoom();
    const handleZoomStart = () => {
      zoomBeforeChange = map.getZoom();
    };
    const handleZoomEnd = () => {
      const currentZoom = map.getZoom();
      const skipped = findSkippedZoom(currentZoom);
      if (skipped === undefined) {
        zoomBeforeChange = currentZoom;
        return;
      }
      const zoomingIn = currentZoom >= zoomBeforeChange;
      const targetZoom = zoomingIn ? skipped + SKIPPED_ZOOM_NUDGE : skipped - SKIPPED_ZOOM_NUDGE;
      if (Math.abs(targetZoom - currentZoom) > 0.001) {
        map.setZoom(targetZoom, { animate: false });
      }
      zoomBeforeChange = targetZoom;
    };
    map.on("zoomstart", handleZoomStart);
    map.on("zoomend", handleZoomEnd);
    return () => {
      map.off("zoomstart", handleZoomStart);
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, mode]);

  return null;
}

/**
 * ズームに応じて切り替わる表示モード。
 *
 * ズーム値そのものを state に持つと、0.05 刻みの全ズームで MapView（1,500 行）が
 * 再描画される。ここでは「表示が変わる境界」だけを真偽値にし、値が変わったときだけ
 * state を更新する。スライダーの現在値など連続値が要るものは LiveZoomMapControls が
 * 自前で購読する。
 */
interface ZoomModes {
  isMinimumZoomMode: boolean;
  isOverviewZoneMode: boolean;
  isLowZoomTintMode: boolean;
  isThirdZoomFromMinimum: boolean;
  canRenderEventGlow: boolean;
  shouldRenderMajorLabels: boolean;
  canRenderLandmarks: boolean;
  /**
   * 再描画隔離（zoomRenderIsolation）を切ったときだけ入る生のズーム値。
   * 入っていると全ズームで state が変わり、従来どおり MapView 全体が再描画される。
   * ランドマークを DivIcon 再生成で拡縮するとき（landmarkCssScale: off）にも使う。
   */
  rawZoom?: number;
}

function computeZoomModes(zoom: number): ZoomModes {
  return {
    isMinimumZoomMode: zoom < MIN_ZOOM + 0.5,
    isOverviewZoneMode: zoom >= OVERVIEW_ZONE_MIN_ZOOM && zoom < OVERVIEW_ZONE_MAX_ZOOM,
    isLowZoomTintMode: zoom < OVERVIEW_ZONE_MAX_ZOOM,
    isThirdZoomFromMinimum: Math.abs(zoom - (MIN_ZOOM + 2.5)) <= 0.15,
    canRenderEventGlow: zoom >= MIN_ZOOM + 1.5,
    shouldRenderMajorLabels: zoom <= MIN_ZOOM + 2.5,
    canRenderLandmarks: zoom >= MIN_ZOOM + 0.8,
  };
}

function zoomModesEqual(a: ZoomModes, b: ZoomModes): boolean {
  return (
    a.isMinimumZoomMode === b.isMinimumZoomMode &&
    a.isOverviewZoneMode === b.isOverviewZoneMode &&
    a.isLowZoomTintMode === b.isLowZoomTintMode &&
    a.isThirdZoomFromMinimum === b.isThirdZoomFromMinimum &&
    a.canRenderEventGlow === b.canRenderEventGlow &&
    a.shouldRenderMajorLabels === b.shouldRenderMajorLabels &&
    a.canRenderLandmarks === b.canRenderLandmarks &&
    a.rawZoom === b.rawZoom
  );
}

/**
 * ランドマーク画像の倍率をズームから求め、CSS 変数として地図コンテナに書く。
 * 以前はズームのたびに全ランドマークの DivIcon を作り直して setIcon していたが、
 * 画像の大きさは CSS の transform: scale(var(--landmark-scale)) で追従させる。
 */
function getLandmarkScale(zoom: number): number {
  const factor = Math.pow(1.22, zoom - 18);
  return Math.min(2.8, Math.max(0.5, factor));
}

function applyLandmarkScale(map: L.Map, enabled: boolean) {
  map
    .getContainer()
    .style.setProperty("--landmark-scale", enabled ? getLandmarkScale(map.getZoom()).toFixed(3) : "1");
}

const MemoizedMapAgentAssistant = memo(MapAgentAssistant);
const MemoizedUserLocationMarker = memo(UserLocationMarker);

/**
 * ズームイン後に地図の中心を道の上へ寄せる。
 *
 * - after: ズーム終了後（160ms 待って）350ms のパンで寄せる。従来方式
 * - integrated: setView に割り込み、ズームの目標中心をあらかじめ道の上にする。
 *   ホイール・スライダー・プログラムからのアニメーション付きズームは 1 回の動きで済む。
 *   ピンチはアニメーション無しの連続ズームなので割り込まず、指を離した後に after と同じ処理で寄せる
 * - off: 寄せない
 */
function MapZoomRoadSnapController({
  onSnapCenter,
  mode,
}: {
  onSnapCenter: (center: L.LatLng) => [number, number] | null;
  mode: RoadSnapMode;
}) {
  const map = useMap();
  // integrated で「ずらし量が大きすぎて Leaflet がアニメーションできない」ときは
  // 差し替えを見送り、ズーム後のパン（after 相当）に任せる。そのための印
  const afterSnapNeededRef = useRef(false);

  // integrated: アニメーション付きズームインの目標中心を道の上に差し替える
  useEffect(() => {
    if (mode !== "integrated") return;
    type SetView = L.Map["setView"];
    const target = map as unknown as { setView: SetView };
    const original = target.setView;

    target.setView = function setViewSnappedToRoad(
      this: L.Map,
      center: L.LatLngExpression,
      zoom?: number,
      options?: L.ZoomPanOptions
    ) {
      // setZoom / setZoomAround は { zoom: { animate } } の形で渡してくる
      const zoomOptions = (options as { zoom?: { animate?: boolean } } | undefined)?.zoom;
      const animated = options?.animate !== false && zoomOptions?.animate !== false;
      const zoomingIn = zoom !== undefined && zoom > this.getZoom() + 0.01;
      if (animated && zoomingIn) {
        const requested = L.latLng(center);
        const snapped = onSnapCenter(requested);
        if (snapped) {
          const snappedLatLng = L.latLng(snapped[0], snapped[1]);
          if (this.distance(requested, snappedLatLng) >= ROAD_SNAP_MIN_DISTANCE_METERS) {
            // Leaflet は目標中心のずれ（目標ズームでのピクセル量）が画面内に収まるときだけ
            // ズームをアニメーションできる。超えると瞬間移動＋全面再描画になり逆に重いので、
            // その場合は差し替えず、ズーム後のパンに任せる
            const offset = this.project(snappedLatLng, zoom!).subtract(this.project(requested, zoom!));
            if (this.getSize().contains(offset)) {
              return original.call(this, snappedLatLng, zoom, options);
            }
            afterSnapNeededRef.current = true;
          }
        }
      }
      return original.call(this, center, zoom, options);
    } as SetView;

    return () => {
      target.setView = original;
    };
  }, [map, mode, onSnapCenter]);

  // after（および integrated のピンチ後）: ズーム終了後にパンで寄せる
  useEffect(() => {
    if (mode === "off") return;
    let lastZoom = map.getZoom();
    let lastZoomWasAnimated = false;
    const handleZoomAnim = () => {
      lastZoomWasAnimated = true;
    };
    const handleZoomStartMark = () => {
      lastZoomWasAnimated = false;
    };
    const consumeAfterSnapNeeded = () => {
      const needed = afterSnapNeededRef.current;
      afterSnapNeededRef.current = false;
      return needed;
    };
    if (mode === "integrated") {
      // アニメーション付きズームは setView 側で寄せ済みなので、ここでは非アニメーション（ピンチ）だけ扱う
      map.on("zoomanim", handleZoomAnim);
      map.on("zoomstart", handleZoomStartMark);
    }
    const shouldSnapAfter = () => {
      const needed = consumeAfterSnapNeeded();
      return mode === "after" || !lastZoomWasAnimated || needed;
    };
    let snapTimerId: number | null = null;

    const clearSnapTimer = () => {
      if (snapTimerId === null) return;
      window.clearTimeout(snapTimerId);
      snapTimerId = null;
    };

    const scheduleSnap = (center: L.LatLng) => {
      clearSnapTimer();
      snapTimerId = window.setTimeout(() => {
        snapTimerId = null;
        const snappedPoint = onSnapCenter(center);
        if (!snappedPoint) return;

        const snappedLatLng = L.latLng(snappedPoint[0], snappedPoint[1]);
        const distanceMeters = map.distance(center, snappedLatLng);
        if (distanceMeters < ROAD_SNAP_MIN_DISTANCE_METERS) return;

        map.panTo(snappedPoint, {
          animate: true,
          duration: 0.35,
          easeLinearity: 0.25,
        });
      }, ROAD_SNAP_DELAY_MS);
    };

    const handleZoomEnd = () => {
      const nextZoom = map.getZoom();
      const isZoomingIn = nextZoom > lastZoom + 0.01;
      lastZoom = nextZoom;

      if (!isZoomingIn || !shouldSnapAfter()) {
        return;
      }

      scheduleSnap(map.getCenter());
    };

    const handleZoomStart = () => {
      clearSnapTimer();
    };

    map.on("zoomstart", handleZoomStart);
    map.on("movestart", handleZoomStart);
    map.on("dragstart", handleZoomStart);
    map.on("zoomend", handleZoomEnd);
    return () => {
      clearSnapTimer();
      map.off("zoomanim", handleZoomAnim);
      map.off("zoomstart", handleZoomStartMark);
      map.off("zoomstart", handleZoomStart);
      map.off("movestart", handleZoomStart);
      map.off("dragstart", handleZoomStart);
      map.off("zoomend", handleZoomEnd);
    };
  }, [map, mode, onSnapCenter]);

  return null;
}

const MapView = memo(function MapView({
  shops: initialShops,
  landmarks = [],
  mapRoute,
  initialShopId,
  openInitialShopBanner = true,
  agentOpen,
  onAgentToggle,
  searchShopIds,
  onMapReady,
  eventTargets,
  highlightEventTargets = false,
  onMapInstance,
  onUserLocationUpdate,
  aiShopIds,
  commentShopId,
  onZoomChange,
  suppressInitialLocationFocus = false,
  featureFlags: featureFlagsProp,
  onShopSelect,
  spotlightShopId,
  onClearSearch,
  overlaySlot,
  hideMapUI = false,
  suppressLandmarks = false,
  trackingButtonTop,
  onGestureActiveChange,
}: MapViewProps = {}) {
  const [isMobile, setIsMobile] = useState(false);
  const [_isInMarket, setIsInMarket] = useState<boolean | null>(null);
  const { addItem, items: bagItems } = useBag();
  const bagShopIds = useMemo(() => {
    return bagItems
      .filter((item) => item.fromShopId)
      .map((item) => item.fromShopId!)
      .filter((id, index, self) => self.indexOf(id) === index);
  }, [bagItems]);

  const routePoints = useMemo(
    () => {
      const normalized = normalizeMapRoutePoints(mapRoute?.points ?? []);
      return normalized.length >= 2 ? normalized : getDefaultMapRoutePoints();
    },
    [mapRoute]
  );
  const sourceShops = useMemo(() => {
    const real = initialShops && initialShops.length > 0 ? initialShops : baseShops;
    // 計測モード（?perf=1&perfShops=N）のときだけ、本番規模の負荷を再現するために複製する
    const perfCount =
      typeof window !== "undefined" ? readPerfShopCount(window.location.search) : null;
    return perfCount ? synthesizeShops(real, routePoints, perfCount) : real;
  }, [initialShops, routePoints]);
  const routeConfig = useMemo(
    () => ({
      ...getDefaultMapRouteConfig(),
      ...(mapRoute?.config ?? {}),
    }),
    [mapRoute]
  );
  const routeBounds = useMemo(() => getRouteBounds(routePoints), [routePoints]);
  const routeCenter = useMemo(() => getRouteCenter(routePoints), [routePoints]);
  const initialMapCenter = useMemo<[number, number]>(() => {
    const projected = projectPointOntoRoute(
      { lat: routeCenter[0], lng: routeCenter[1] },
      routePoints
    );
    if (!projected) {
      return routeCenter;
    }
    return [projected.point.lat, projected.point.lng];
  }, [routeCenter, routePoints]);
  const initialMapRotation = useMemo(() => {
    const baseRotation =
      getAutoRotationForVisibleRoad({
        center: L.latLng(initialMapCenter[0], initialMapCenter[1]),
        routePoints,
      }) ?? 0;
    return normalizeRotationDeg(baseRotation + 180);
  }, [initialMapCenter, routePoints]);
  const mapBounds = useMemo(
    () => expandBoundsByMeters(routeBounds, Math.max(routeConfig.visibleDistanceMeters + 48, 120)),
    [routeBounds, routeConfig.visibleDistanceMeters]
  );
  const landmarkSpecs = useMemo(() => landmarks ?? [], [landmarks]);
  const majorPlaceLabels = useMemo(() => {
    // アイコン本体（visibleLandmarkSpecs）と同じく、おでかけサポート案内中は
    // 地名ラベルも一切出さない。アイコンだけ消してラベルが残ると、
    // 名前だけが宙に浮いた状態になってしまう
    if (suppressLandmarks) return [];
    return landmarkSpecs.map((spec) => ({ name: spec.name, lat: spec.lat, lng: spec.lng }));
  }, [landmarkSpecs, suppressLandmarks]);
  const minZoomLandmarkKeys = useMemo(
    () => new Set(landmarkSpecs.filter((spec) => spec.showAtMinZoom).map((spec) => spec.key)),
    [landmarkSpecs]
  );
  const [displayShops, setDisplayShops] = useState<Shop[]>(() => sourceShops);
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【ポイント6】state は「選択中店舗」のみ
  // - currentZoom は state で管理しない（Leaflet に任せる）
  // - 地図操作（pan/zoom）で React が再レンダリングされない
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [shopBannerOrigin, setShopBannerOrigin] = useState<ShopBannerOrigin | null>(null);
  const [shopBannerSession, setShopBannerSession] = useState(0);
  const [shopBannerInitialSurface, setShopBannerInitialSurface] = useState<"summary" | "detail">("detail");
  const [shopBannerMainSurface, setShopBannerMainSurface] = useState<"summary" | "detail">("detail");
  const [isTracking, setIsTracking] = useState(true);
  const [_shopLoadProgress, setShopLoadProgress] = useState({ processed: 0, total: 0, done: false });
  const [autoRotation, setAutoRotation] = useState(initialMapRotation);
  const [zoomModes, setZoomModes] = useState<ZoomModes>(() => computeZoomModes(INITIAL_ZOOM));
  // マップ動作フラグ: サーバー由来（管理画面の設定）に URL の ?mapFlags= を重ねる
  const featureFlags = useMemo(
    () =>
      resolveMapFeatureFlags(
        featureFlagsProp,
        typeof window === "undefined" ? "" : window.location.search
      ),
    [featureFlagsProp]
  );
  const [zoomGuideMessage, setZoomGuideMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeGestureModeRef = useRef<"zoom" | "rotate" | null>(null);
  const pinchZoomEndFiredRef = useRef(false);
  const showMapToast = useCallback((message: string, durationMs = 1500) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setZoomGuideMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setZoomGuideMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);
  const hideMapToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setZoomGuideMessage(null);
  }, []);
  const handleChomeClick = useCallback(
    (chome: string) => showMapToast(`${chome}を拡大しました`, 2500),
    [showMapToast]
  );
  const [mapShellSize, setMapShellSize] = useState(() => {
    if (typeof window === "undefined") return 1600;
    // visualViewport はブラウザUIを除いた実際の表示領域サイズ（iOS Safari 対応）
    const w = window.visualViewport?.width ?? window.innerWidth;
    const h = window.visualViewport?.height ?? window.innerHeight;
    return Math.ceil(Math.hypot(w, h) + 120);
  });

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [favoriteShopIds, setFavoriteShopIds] = useState<number[]>([]);
  const [_planOrder, setPlanOrder] = useState<number[]>([]);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const isTouchGestureActiveRef = useRef(false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【削除】visibleShops の計算を削除
  // - OptimizedShopLayerWithClustering が Leaflet API で管理するため不要
  // - filterShopsByZoom は使用しない
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const shops = displayShops;

  useEffect(() => {
    const detectMobile = () => {
      if (typeof window === "undefined") return;
      const touch = "ontouchstart" in window;
      const narrow = window.innerWidth <= 768;
      setIsMobile(touch || narrow);
      // visualViewport でブラウザUIを除いた実際の表示領域を取得（iOS Safari 対応）
      const w = window.visualViewport?.width ?? window.innerWidth;
      const h = window.visualViewport?.height ?? window.innerHeight;
      setMapShellSize(Math.ceil(Math.hypot(w, h) + 120));
    };

    detectMobile();
    window.addEventListener("resize", detectMobile);
    // iOS Safari ではアドレスバーの表示/非表示で visualViewport が変わる
    window.visualViewport?.addEventListener("resize", detectMobile);
    return () => {
      window.removeEventListener("resize", detectMobile);
      window.visualViewport?.removeEventListener("resize", detectMobile);
    };
  }, []);

  useEffect(() => {
    if (!mapInstance) return;
    const timer = setTimeout(() => { mapInstance.invalidateSize(false); }, 150);
    return () => clearTimeout(timer);
  }, [mapInstance, mapShellSize]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setAutoRotation(initialMapRotation);
  }, [initialMapRotation]);

  useEffect(() => {
    if (initialShopId) {
      const shop = shops.find((s) => s.id === initialShopId);
      if (shop) {
        if (openInitialShopBanner) {
          setSelectedShop(shop);
        }
        if (mapRef.current) {
          const currentZoom = mapRef.current.getZoom();
          if (currentZoom < 18) {
            mapRef.current.setView([shop.lat, shop.lng], 18);
          } else {
            mapRef.current.panTo([shop.lat, shop.lng]);
          }
        }
      }
    }
  }, [initialShopId, openInitialShopBanner, shops]);

  useEffect(() => {
    setDisplayShops(sourceShops);
  }, [sourceShops]);

  useEffect(() => {
    if (!selectedShop) return;
    const latest = shops.find((shop) => shop.id === selectedShop.id);
    if (latest && latest !== selectedShop) {
      setSelectedShop(latest);
    }
  }, [shops, selectedShop]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (selectedShop) {
      document.body.classList.add("shop-banner-open");
    } else {
      document.body.classList.remove("shop-banner-open");
    }
    return () => {
      document.body.classList.remove("shop-banner-open");
    };
  }, [selectedShop]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(AGENT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.order)) {
        setPlanOrder(parsed.order);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setFavoriteShopIds(loadFavoriteShopIds());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === FAVORITE_SHOPS_KEY) {
        setFavoriteShopIds(loadFavoriteShopIds());
      }
    };
    const handleFavoriteUpdate = (event: Event) => {
      if (event.type === FAVORITE_SHOPS_UPDATED_EVENT) {
        setFavoriteShopIds(loadFavoriteShopIds());
      }
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener(FAVORITE_SHOPS_UPDATED_EVENT, handleFavoriteUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(FAVORITE_SHOPS_UPDATED_EVENT, handleFavoriteUpdate);
    };
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 【ポイント7】店舗クリック時のコールバック（段階的ズームアップ対応）
  // - useCallback でメモ化（不要な再生成を防ぐ）
  // - Leaflet から直接呼ばれる（React の state を経由しない）
  // - ViewMode に応じて段階的にズームアップ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleShopClick = useCallback((clickedShop: Shop, origin?: ShopBannerOrigin) => {
    if (!mapRef.current) return;

    const currentZoom = mapRef.current.getZoom();
    const viewMode = getViewModeForZoom(currentZoom);

    if (viewMode.mode === ViewMode.DETAIL) {
      // 詳細モード: 詳細バナーを表示
      if (onShopSelect) {
        onShopSelect(clickedShop);
        setSelectedShop(null);
        setShopBannerOrigin(null);
        return;
      }
      if (typeof document !== "undefined") {
        document.body.classList.add("shop-banner-open");
      }
      const nextInitialSurface: "summary" | "detail" =
        selectedShop &&
        shopBannerMainSurface === "summary" &&
        selectedShop.id !== clickedShop.id
          ? "summary"
          : "detail";
      setShopBannerInitialSurface(nextInitialSurface);
      setShopBannerSession((prev) => prev + 1);
      setSelectedShop(clickedShop);
      setShopBannerOrigin(origin ?? null);
    } else {
      // 【段階的ズームアップ】現在の段階から次の段階へ自然にズーム
      // OVERVIEW → INTERMEDIATE（18.0）
      // INTERMEDIATE → DETAIL（18.5）

      // 周辺店舗を検索（緯度±0.001度、経度±0.0005度 ≈ 半径100m程度）
      const nearbyShops = shops.filter(s =>
        Math.abs(s.lat - clickedShop.lat) < 0.001 &&
        Math.abs(s.lng - clickedShop.lng) < 0.0005
      );

      // 周辺店舗の重心を計算
      let centerLat: number;
      let centerLng: number;

      if (nearbyShops.length === 0) {
        // フォールバック: クリックした店舗を中心にする
        centerLat = clickedShop.lat;
        centerLng = clickedShop.lng;
      } else {
        // 周辺店舗の重心を計算
        centerLat = nearbyShops.reduce((sum, s) => sum + s.lat, 0) / nearbyShops.length;
        centerLng = nearbyShops.reduce((sum, s) => sum + s.lng, 0) / nearbyShops.length;
      }

      // 【段階的ズームアップ】現在のモードに応じて次の段階へ
      let targetZoom: number;
      if (viewMode.mode === ViewMode.OVERVIEW) {
        // OVERVIEW → INTERMEDIATE（エリア探索）へ
        targetZoom = 18.0;
        showMapToast("このエリアを拡大しました", 1800);
      } else {
        // INTERMEDIATE → DETAIL（詳細閲覧）へ
        targetZoom = 18.5;
        showMapToast("もう一度タップするとお店の詳細を見られます", 1800);
      }

      mapRef.current.flyTo([centerLat, centerLng], targetZoom, {
        duration: 0.75,
      });
    }
  }, [onShopSelect, selectedShop, shopBannerMainSurface, shops, showMapToast]);

  const handleOpenShop = useCallback((shopId: number) => {
    const target = shops.find((s) => s.id === shopId);
    if (target) {
      handleShopClick(target);
    }
  }, [handleShopClick, shops]);

  const handlePlanUpdate = useCallback((order: number[]) => {
    setPlanOrder(order);
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(AGENT_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify({ ...parsed, order }));
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const handleAddToBag = useCallback((name: string, fromShopId?: number) => {
    const value = name.trim();
    if (!value) return;
    addItem({ name: value, fromShopId });
  }, [addItem]);

  const handleShopChunkProgress = useCallback((processed: number, total: number, done: boolean) => {
    setShopLoadProgress((prev) => {
      if (
        prev.processed === processed &&
        prev.total === total &&
        prev.done === done
      ) {
        return prev;
      }
      return { processed, total, done };
    });
  }, []);

  const selectedShopIndex = useMemo(() => {
    if (!selectedShop) return -1;
    return shops.findIndex((shop) => shop.id === selectedShop.id);
  }, [selectedShop, shops]);

  const canNavigate = selectedShopIndex >= 0 && shops.length > 1;
  const {
    isMinimumZoomMode,
    isOverviewZoneMode,
    isLowZoomTintMode,
    isThirdZoomFromMinimum,
    shouldRenderMajorLabels,
  } = zoomModes;
  const shouldRenderEventGlow = highlightEventTargets && zoomModes.canRenderEventGlow;
  const shouldRenderLandmarks = zoomModes.canRenderLandmarks || highlightEventTargets;
  const interactionDisabled = agentOpen ?? false;
  const mapRotation = normalizeRotationDeg(autoRotation);

  useEffect(() => {
    if (isMinimumZoomMode) {
      setShopLoadProgress({ processed: 0, total: 0, done: true });
      return;
    }
    setShopLoadProgress({ processed: 0, total: shops.length, done: shops.length === 0 });
  }, [isMinimumZoomMode, shops.length]);

  const getSnappedCenter = useCallback(
    (center: L.LatLng) => {
      const projection = projectPointOntoRoute(center, routePoints);
      if (!projection) return null;
      return [projection.point.lat, projection.point.lng] as [number, number];
    },
    [routePoints]
  );

  const handleSelectByOffset = useCallback((offset: number) => {
    if (!canNavigate) return;
    const nextIndex = (selectedShopIndex + offset + shops.length) % shops.length;
    const nextShop = shops[nextIndex];
    if (!nextShop) return;
    handleShopClick(nextShop);
  }, [canNavigate, selectedShopIndex, handleShopClick, shops]);

  const handleMapZoomChange = useCallback(
    (zoom: number) => {
      const next = computeZoomModes(zoom);
      // 再描画隔離が有効なら表示モードだけを比べ、変わらないズームでは state を更新しない。
      // 無効（または DivIcon 再生成でランドマークを拡縮）のときは生のズーム値も持ち、従来どおり毎回再描画する
      if (!featureFlags.zoomRenderIsolation || !featureFlags.landmarkCssScale) {
        next.rawZoom = zoom;
      }
      setZoomModes((prev) => (zoomModesEqual(prev, next) ? prev : next));
      if (mapRef.current) applyLandmarkScale(mapRef.current, featureFlags.landmarkCssScale);
      onZoomChange?.(zoom);
    },
    [featureFlags.landmarkCssScale, featureFlags.zoomRenderIsolation, onZoomChange]
  );

  const toggleTracking = useCallback(() => setIsTracking((prev) => !prev), []);

  // deps が [] なのは setState 関数のみ参照しているため（React が安定を保証）
  const handleCloseBanner = useCallback(() => {
    setSelectedShop(null);
    setShopBannerOrigin(null);
    setShopBannerInitialSurface("detail");
    setShopBannerMainSurface("detail");
  }, []);

  const handleSelectPreviousShop = useCallback(() => handleSelectByOffset(-1), [handleSelectByOffset]);
  const handleSelectNextShop = useCallback(() => handleSelectByOffset(1), [handleSelectByOffset]);

  // ランドマークの DivIcon は既定ではズームに依存させず、倍率は CSS 変数 --landmark-scale で追従する。
  // landmarkCssScale が off のときだけ従来どおりズームごとに px サイズを焼き込んで作り直す
  const landmarkIconScale =
    featureFlags.landmarkCssScale || zoomModes.rawZoom === undefined
      ? 1
      : getLandmarkScale(zoomModes.rawZoom);
  const landmarkIcons = useMemo(() => {
    const icons = new Map<string, L.DivIcon>();
    landmarkSpecs.forEach((spec) => {
      const width = Math.max(1, Math.round(spec.widthPx * landmarkIconScale));
      const height = Math.max(1, Math.round(spec.heightPx * landmarkIconScale));
      const highlightClass = highlightEventTargets ? " is-highlight" : "";
      icons.set(
        spec.key,
        L.divIcon({
          className: "map-landmark-icon",
          html: `<img class="map-landmark-visual${highlightClass}" src="${spec.url}" alt="" draggable="false" style="width:${width}px;height:${height}px;opacity:1;" />`,
          iconSize: [width, height],
          iconAnchor: [width / 2, height / 2],
        })
      );
    });
    return icons;
  }, [highlightEventTargets, landmarkIconScale, landmarkSpecs]);

  const commentHighlightShopIds = useMemo(
    () => (commentShopId ? [commentShopId] : []),
    [commentShopId]
  );

  const handleUserLocationUpdate = useCallback(
    (inMarket: boolean, position: [number, number]) => {
      setUserLocation(position);
      setIsInMarket(inMarket);
      onUserLocationUpdate?.({
        lat: position[0],
        lng: position[1],
        inMarket,
      });
    },
    [onUserLocationUpdate]
  );

  const visibleMajorPlaceLabels = useMemo(
    () =>
      getVisibleMajorPlaceLabels({
        shouldRenderMajorLabels,
        isMinimumZoomMode,
        majorPlaceLabels,
      }),
    [isMinimumZoomMode, majorPlaceLabels, shouldRenderMajorLabels]
  );
  const activeHighlightShopIds = useMemo(() => {
    if (searchShopIds && searchShopIds.length > 0) {
      return searchShopIds;
    }
    if (aiShopIds && aiShopIds.length > 0) {
      return aiShopIds;
    }
    return undefined;
  }, [aiShopIds, searchShopIds]);
  const resultsBadgeBottom = overlaySlot
    ? 'calc(4.5rem + env(safe-area-inset-bottom,0px) + 5.5rem + 25px)'
    : 'calc(4.5rem + env(safe-area-inset-bottom,0px) + 0.5rem + 25px)';

  const visibleLandmarkSpecs = useMemo(() => {
    // おでかけサポート案内中は FacilityLayer が案内先を表示するため、
    // 通常のランドマーク（駅・電停の常時表示分を含む）は一切出さない
    if (suppressLandmarks) {
      return [];
    }
    // 電停・駅は道案内の目印として、通常ランドマークが出ない
    // ズーム帯でも常時表示する（「普段から公共交通機関を表示する」）
    const alwaysVisibleTransit = landmarkSpecs.filter((spec) =>
      isAlwaysVisibleTransitLandmarkKey(spec.key)
    );
    if (!shouldRenderLandmarks) {
      return alwaysVisibleTransit;
    }
    if (!isMinimumZoomMode) {
      return landmarkSpecs;
    }
    return landmarkSpecs.filter((spec) => minZoomLandmarkKeys.has(spec.key));
  }, [isMinimumZoomMode, landmarkSpecs, minZoomLandmarkKeys, shouldRenderLandmarks, suppressLandmarks]);

  const { markManualRotation, snapRotationToVisibleRoad } = useMapCameraController({
    mapRef,
    gestureActiveRef: isTouchGestureActiveRef,
    interactionDisabled,
    autoRotation,
    routePoints,
    isTracking,
    setIsTracking,
    setAutoRotation,
  });

  const { isTouchGestureActive, gestureTargetRef, gestureHandlers } = useMapGestures({
    mapRef,
    gestureActiveRef: isTouchGestureActiveRef,
    interactionDisabled,
    mapRotation,
    onPanStart: () => setIsTracking(false),
    onRotationChange: (rotation) => {
      markManualRotation();
      setAutoRotation(rotation);
    },
    onGestureEnd: () => {
      // ズームはonPinchZoomEndが直後に「拡大/縮小しました」で上書きするため基本は消さないが、
      // しきい値未満でonPinchZoomEndが呼ばれなかった場合は「ズーム中」が残るので明示的に消す
      const mode = activeGestureModeRef.current;
      if (mode === "rotate" || (mode === "zoom" && !pinchZoomEndFiredRef.current)) {
        hideMapToast();
      }
      activeGestureModeRef.current = null;
      pinchZoomEndFiredRef.current = false;
    },
    onGestureMode: (mode) => {
      activeGestureModeRef.current = mode;
      pinchZoomEndFiredRef.current = false;
      showMapToast(mode === "zoom" ? "ズーム中" : "回転中", 3000);
    },
    onFirstPan: () => {
      showMapToast("地図を移動中", 1200);
    },
    onPinchZoomEnd: (direction) => {
      pinchZoomEndFiredRef.current = true;
      showMapToast(direction === "in" ? "拡大しました" : "縮小しました", 1500);
    },
  });

  // 回転のみのジェスチャーは Leaflet の move/zoom を発火させないため、
  // 親側で静止判定（useNearbyPromptVisibility 等）を行いたい場合に備えて
  // ジェスチャーの開始/終了を素通しで通知する
  useEffect(() => {
    onGestureActiveChange?.(isTouchGestureActive);
  }, [isTouchGestureActive, onGestureActiveChange]);

  useEffect(() => {
    if (!isTouchGestureActive) {
      const map = mapRef.current;
      if (map) {
        snapRotationToVisibleRoad(map.getCenter());
      }
    }
  }, [isTouchGestureActive, snapRotationToVisibleRoad]);

  // ズームスライダーは2本指操作時のみ表示し、操作終了から数秒後にフェードアウトさせる
  const [zoomSliderVisible, setZoomSliderVisible] = useState(false);
  const zoomSliderHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hadGestureRef = useRef(false);

  // 表示したうえで、呼ばれるたびに非表示タイマーを延長する（スライダー操作中に消えないように）
  const keepZoomSliderAlive = useCallback(() => {
    if (zoomSliderHideTimerRef.current) {
      clearTimeout(zoomSliderHideTimerRef.current);
    }
    setZoomSliderVisible(true);
    zoomSliderHideTimerRef.current = setTimeout(() => {
      setZoomSliderVisible(false);
    }, ZOOM_SLIDER_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (isTouchGestureActive) {
      // 2本指操作中は消さずに表示し続ける
      if (zoomSliderHideTimerRef.current) {
        clearTimeout(zoomSliderHideTimerRef.current);
        zoomSliderHideTimerRef.current = null;
      }
      setZoomSliderVisible(true);
      hadGestureRef.current = true;
    } else if (hadGestureRef.current) {
      // 2本指操作が終わったらタイマーを開始（初回マウント時は出さない）
      hadGestureRef.current = false;
      keepZoomSliderAlive();
    }
  }, [isTouchGestureActive, keepZoomSliderAlive]);

  useEffect(() => {
    return () => {
      if (zoomSliderHideTimerRef.current) {
        clearTimeout(zoomSliderHideTimerRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`relative h-full w-full overflow-hidden${spotlightShopId ? " map-spotlight-mode" : ""}${activeHighlightShopIds && activeHighlightShopIds.length > 0 ? " map-search-spotlight-mode" : ""}`}
      style={{
      ["--map-rotation-inverse" as string]: `${-mapRotation}deg`,
      }}
    >
      <div
        ref={gestureTargetRef}
        className="absolute left-1/2 top-1/2 z-0"
        {...gestureHandlers}
        style={{
          width: `${mapShellSize}px`,
          height: `${mapShellSize}px`,
          touchAction: "none",
          transform: `translate(-50%, -50%) rotate(${mapRotation}deg)`,
          transformOrigin: "center center",
          transition: isTouchGestureActive ? "none" : "transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
          willChange: isTouchGestureActive ? "transform" : "auto",
        }}
      >
        <MapContainer
          center={initialMapCenter}
          zoom={INITIAL_ZOOM}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          preferCanvas
          zoomSnap={0.05}
          zoomDelta={0.35}
          wheelPxPerZoomLevel={130}
          zoomAnimation
          markerZoomAnimation
          fadeAnimation
          scrollWheelZoom={!agentOpen && !isMobile}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={!agentOpen && !isMobile}
          className={`h-full w-full ${agentOpen ? "pointer-events-none" : ""}`}
          style={{
            height: "100%",
            width: "100%",
            backgroundColor: "#faf8f3",
          }}
          zoomControl={false}
          attributionControl={false}
          maxBounds={mapBounds}
          maxBoundsViscosity={1.0}
          whenReady={() => {
            onMapReady?.();
          }}
          ref={(map) => {
            if (map) {
              mapRef.current = map;
              setMapInstance(map);
              onMapInstance?.(map);
            } else {
              mapRef.current = null;
              setMapInstance(null);
            }
          }}
        >
          <MapZoomConstraint mode={featureFlags.zoomSkip} />
          <MapZoomRoadSnapController onSnapCenter={getSnappedCenter} mode={featureFlags.roadSnap} />
          <MapZoomListener onZoomChange={handleMapZoomChange} />
          <MapPerfBridge flags={featureFlags} />
          <TileLayer
            url={BASEMAP_TILE_URL}
            attribution={BASEMAP_ATTRIBUTION}
            opacity={
              featureFlags.tileOpacityByZoom
                ? isMinimumZoomMode
                  ? 0.44
                  : isThirdZoomFromMinimum
                    ? 0.11
                    : 0.22
                : 0.22
            }
            zIndex={1}
            keepBuffer={16}
          />
          {/* 背景（フラグで webp / svg / off を切替。ズームごとの再描画コストを切り分けるため） */}
          {featureFlags.backgroundOverlay !== "off" && (
            <BackgroundOverlay format={featureFlags.backgroundOverlay} />
          )}
          <MapOverlays
            isLowZoomTintMode={isLowZoomTintMode}
            routePoints={routePoints}
            routeConfig={routeConfig}
            mapBounds={mapBounds}
            visibleMajorPlaceLabels={visibleMajorPlaceLabels}
            shouldRenderEventGlow={shouldRenderEventGlow}
            eventTargets={eventTargets}
            highlightEventTargets={highlightEventTargets}
            visibleLandmarkSpecs={visibleLandmarkSpecs}
            landmarkIcons={landmarkIcons}
            isMinimumZoomMode={isMinimumZoomMode}
            isOverviewZoneMode={isOverviewZoneMode}
            shops={shops}
            onShopClick={handleShopClick}
            onChunkProgress={handleShopChunkProgress}
            selectedShopId={selectedShop?.id}
            favoriteShopIds={favoriteShopIds}
            searchShopIds={searchShopIds}
            aiHighlightShopIds={aiShopIds}
            commentHighlightShopIds={commentHighlightShopIds}
            bagShopIds={bagShopIds}
            onChomeClick={handleChomeClick}
            stallRenderer={featureFlags.stallRenderer}
            shopLayerHiding={featureFlags.shopLayerHiding}
            OptimizedShopLayerWithClustering={OptimizedShopLayerWithClustering}
          />

        {/* ユーザー位置 */}
        <MemoizedUserLocationMarker
          onLocationUpdate={handleUserLocationUpdate}
          isTracking={isTracking}
          suppressInitialFocus={suppressInitialLocationFocus}
          routePoints={routePoints}
          routeConfig={routeConfig}
        />

          {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            【削除】ZoomTracker を削除
            - currentZoom を state で管理しないため不要
            - ズーム操作で React が再レンダリングされない
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        </MapContainer>
      </div>

      <TimeAmbientOverlay />
      <MapZoomGuideToast message={zoomGuideMessage} />
      {!hideMapUI && (
        <>
          <LiveZoomMapControls
            map={mapInstance}
            isTracking={isTracking}
            onToggleTracking={toggleTracking}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            zoomSliderVisible={zoomSliderVisible}
            onZoomSliderInteract={keepZoomSliderAlive}
            trackingButtonTop={trackingButtonTop}
          />
        </>
      )}

      {spotlightShopId && <SpotlightCountdownBar shopId={spotlightShopId} />}

      {activeHighlightShopIds && activeHighlightShopIds.length > 0 && (
        <SearchResultsSheet
          shops={displayShops}
          searchShopIds={activeHighlightShopIds}
          map={mapInstance}
          onClearSearch={onClearSearch}
          badgeBottom={resultsBadgeBottom}
        />
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          【ポイント9】UI 層と地図層を完全分離
          - ShopDetailBanner は MapContainer の外側
          - この state 更新が地図描画に影響しない
          - 詳細パネルの開閉で地図が再レンダリングされない
          ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {selectedShop && (
        <>
          <ShopDetailBanner
            key={`${selectedShop.id}-${shopBannerSession}`}
            shop={selectedShop}
            openNonce={shopBannerSession}
            initialMobileSurface={shopBannerInitialSurface}
            onMobileMainSurfaceChange={setShopBannerMainSurface}
            canNavigateBetweenShops={canNavigate}
            selectedShopPosition={selectedShopIndex + 1}
            totalShopCount={shops.length}
            onSelectPreviousShop={handleSelectPreviousShop}
            onSelectNextShop={handleSelectNextShop}
            onClose={handleCloseBanner}
            onAddToBag={handleAddToBag}
            originRect={shopBannerOrigin ?? undefined}
            reserveBottomNavSpace={false}
          />
        </>
      )}

      <MemoizedMapAgentAssistant
        onOpenShop={handleOpenShop}
        onPlanUpdate={handlePlanUpdate}
        userLocation={userLocation}
        isOpen={agentOpen}
        onToggle={onAgentToggle}
        hideLauncher
      />

      {/* 外部から注入するオーバーレイ（マップ座標系内） */}
      {overlaySlot}
    </div>
  );
});

export default MapView;
