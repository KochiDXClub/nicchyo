"use client";

/**
 * MapLibre GL JS 版のマップ（移行の第 1 段階）
 *
 * Leaflet 版（../MapView.tsx）と並走させ、lib/mapFeatureFlags.ts の renderer=maplibre で
 * 切り替える。管理画面と計測ページから同じ条件で比較できるようにするのが目的。
 *
 * 【この段階で持っているもの】
 * - 背景地図（CARTO ラスター / OpenFreeMap ベクター）、市場の色かぶせ、道（ポリゴン・中心線）
 * - 店舗マーカー: シンボルレイヤーで GPU 描画。屋台パーツを Canvas で描き起こしたスプライトを使い、
 *   検索 / AI / 買い物袋 / 選択の状態は画像を差し替えて表現
 * - 木札（店名、text-field ＋ 伸縮する下地画像）、屋根の上の写真窓（styleimagemissing で遅延生成）、
 *   お気に入り・買い物袋バッジ。表示倍率は Leaflet 版の LOD（stall / photo / nameplate）と同じ境界
 * - ランドマーク画像と地名ラベル、丁目バッジ（HTML マーカー）、店舗タップで詳細バナー
 * - 回転・ピンチ・ドラッグは MapLibre 標準（自作ジェスチャー不要）
 * - ページ側の部品（「このへん」の出現判定、ズームスライダー、おでかけサポート、検索結果シート）は
 *   MapCamera アダプタ経由で Leaflet 版と共用
 * - 現在地マーカーと追従（MapLibreUserLocation）、道への吸着（after / integrated）
 * - 計測の橋渡し（?perf=1 で window.__nicchyoMapBench）
 *
 * 【まだ無いもの（Leaflet 版にある）】
 * AI アシスタント（MapAgentAssistant）、出店者のカスタム SVG 屋台。順に移す。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import maplibregl, {
  type ExpressionSpecification,
  type LngLatBoundsLike,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MapViewProps } from "../MapView";
import type { Shop } from "../../data/shops";
import type { Landmark } from "../../types/landmark";
import type { MapRoutePoint } from "../../types/mapRoute";
import { landmarkToSpot } from "@/lib/spots";
import ShopDetailBanner from "../ShopDetailBanner";
import { useBag } from "../../../../../lib/storage/BagContext";
import { FAVORITE_SHOPS_UPDATED_EVENT, loadFavoriteShopIds } from "../../../../../lib/favoriteShops";
import { resolveMapFeatureFlags, type MapFeatureFlags } from "@/lib/mapFeatureFlags";
import { runFullBenchmark, type BenchMapLike } from "@/lib/perf/mapBenchmark";
import { readPerfShopCount, synthesizeShops } from "@/lib/perf/syntheticShops";
import {
  buildRoadPolygon,
  densifyPath,
  expandBoundsByMeters,
  getDefaultMapRoutePoints,
  getEffectiveMapRouteConfig,
  getRouteBounds,
  getRouteCenter,
  getRouteChains,
  normalizeMapRoutePoints,
  projectPointOntoRoute,
  smoothRoutePath,
} from "../../utils/mapRouteGeometry";
import { getRecommendedZoomBounds } from "../../config/roadConfig";
import { OPENFREEMAP_STYLE_URL } from "../../config/basemap";
import {
  OVERVIEW_ZONE_MAX_ZOOM,
  OVERVIEW_ZONE_MIN_ZOOM,
  SHOP_MARKER_LOD_OFFSETS,
} from "../../config/displayConfig";
import { buildCrowdSprites } from "./crowdSprites";
import { buildCrowdPeople, crowdToGeoJSON } from "../../utils/crowdPlacement";
import { CROWD_FRAME_COUNT } from "../../config/crowdParts";
import {
  buildBadgeSprite,
  buildNameplateSprite,
  buildStallSprites,
  rasterizeImageUrl,
  rasterizePhotoCircle,
  stallSpriteKey,
  type StallState,
} from "./stallSprites";
import { getShopBannerImage } from "../../../../../lib/shopImages";
import { MAPLIBRE_MAP_KEY, type MapCamera, type MapCameraEvent } from "../../types/mapCamera";
import { LiveZoomMapControls } from "../MapControls";
import SearchResultsSheet, { SpotlightCountdownBar } from "../SearchResultsSheet";
import MapLibreUserLocation from "./MapLibreUserLocation";
import { ROAD_SNAP_DELAY_MS, ROAD_SNAP_MIN_DISTANCE_METERS } from "@/lib/constants";
import { getRoadSide } from "../../config/roadConfig";
import { resolveStallColors } from "../../config/shopCategories";
import { sanitizeCssColor } from "../../utils/markerHtmlGenerator";

const ZOOM_BOUNDS = getRecommendedZoomBounds();
/**
 * MapLibre は 512px タイル基準なので、同じ縮尺でもズーム値が Leaflet（256px 基準）より 1 小さい。
 * 表示境界（LOD・丁目バッジ・タイル不透明度など）は Leaflet 版の定数を 1 ずらして使う。
 */
const ZOOM_OFFSET = -1;
const MIN_ZOOM = ZOOM_BOUNDS.min + ZOOM_OFFSET;
const MAX_ZOOM = ZOOM_BOUNDS.max + ZOOM_OFFSET;
const INITIAL_ZOOM = MAX_ZOOM;
const OVERVIEW_MIN = OVERVIEW_ZONE_MIN_ZOOM + ZOOM_OFFSET;
const OVERVIEW_MAX = OVERVIEW_ZONE_MAX_ZOOM + ZOOM_OFFSET;

const CARTO_TILES = ["a", "b", "c", "d"].map(
  (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png`
);
const CARTO_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';


/** 市場エリアの色かぶせ画像（BackgroundOverlay と同じ範囲・画像） */
const MARKET_TINT_URL = "/images/maps/market-tint.webp";
const MARKET_TINT_COORDS: [[number, number], [number, number], [number, number], [number, number]] = [
  [133.5265, 33.565],
  [133.545, 33.565],
  [133.545, 33.5555],
  [133.5265, 33.5555],
];

const SRC_ROAD = "nicchyo-road";
const SRC_SHOPS = "nicchyo-shops";
const SRC_LANDMARKS = "nicchyo-landmarks";
const SRC_TINT = "nicchyo-tint";
const SRC_CROWD = "nicchyo-crowd";
const LAYER_SHOPS = "nicchyo-shops";
const LAYER_CROWD = "nicchyo-crowd";
/** 人影の歩きのコマ送り。4〜5fps あれば「動いている」と分かる（60fps は要らない） */
const CROWD_FRAME_INTERVAL_MS = 220;

/**
 * 人影の icon-image。コマ送りは全体で 1 回の setLayoutProperty で済ませる
 * （何体いてもコストは一定）。frame は 0 か 1 を交互に渡す。
 */
function crowdIconImage(frame: number): ExpressionSpecification {
  return [
    "concat",
    "person:",
    ["get", "kind"],
    ":",
    ["to-string", ["get", "flip"]],
    ":",
    ["to-string", ["%", ["+", ["get", "phase"], frame], CROWD_FRAME_COUNT]],
  ];
}

const CHOME_KANJI: Record<string, string> = {
  一丁目: "一",
  二丁目: "二",
  三丁目: "三",
  四丁目: "四",
  五丁目: "五",
  六丁目: "六",
  七丁目: "七",
};

type ShopStateMap = Map<number, StallState>;

/** GeoJSON に載せる店舗ごとの表示状態（状態色・お気に入り・買い物袋） */
interface ShopDisplayState {
  states: ShopStateMap;
  favorites: Set<number>;
  bags: Set<number>;
}

const LAYER_SHOP_PHOTOS = "nicchyo-shop-photos";
const LAYER_SHOP_NAMEPLATES = "nicchyo-shop-nameplates";
const LAYER_SHOP_BADGES_FAVORITE = "nicchyo-shop-badge-favorite";
const LAYER_SHOP_BADGES_BAG = "nicchyo-shop-badge-bag";
const LAYER_LANDMARK_LABELS = "nicchyo-landmark-labels";

/** ランドマークの GeoJSON。selectedKey に一致するものは properties.selected = 1（拡大表示） */
function buildLandmarkFeatures(
  specs: Landmark[],
  selectedKey: string | null
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: specs.map((spec) => ({
      type: "Feature",
      properties: {
        key: spec.key,
        image: `landmark:${spec.key}`,
        name: spec.name,
        showAtMinZoom: spec.showAtMinZoom ? 1 : 0,
        selected: spec.key === selectedKey ? 1 : 0,
      },
      geometry: { type: "Point", coordinates: [spec.lng, spec.lat] },
    })),
  };
}
const IMG_NAMEPLATE = "nameplate-bg";
const IMG_BADGE_FAVORITE = "badge:favorite";
const IMG_BADGE_BAG = "badge:bag";
const PHOTO_SIZE_PX = 50;
const TEXT_FONT = ["Noto Sans Bold"];

function buildRasterStyle(tileOpacityByZoom: boolean): StyleSpecification {
  return {
    version: 8,
    // 文字を出すレイヤーを足すときのためにグリフだけ用意しておく（現状は未使用）
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      carto: {
        type: "raster",
        tiles: CARTO_TILES,
        tileSize: 256,
        attribution: CARTO_ATTRIBUTION,
        maxzoom: 20,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#FFFAF0" } },
      {
        id: "basemap",
        type: "raster",
        source: "carto",
        paint: {
          // Leaflet 版と同じ: 最小ズーム付近は 0.44、それ以外は 0.22
          "raster-opacity": tileOpacityByZoom
            ? (["step", ["zoom"], 0.44, MIN_ZOOM + 0.5, 0.22] as ExpressionSpecification)
            : 0.22,
          "raster-fade-duration": 0,
        },
      },
    ],
  };
}

/** 道の向きに合わせた bearing（Leaflet 版の自動回転と同じく、道が縦になる向き） */
function computeRoadBearing(routePoints: MapRoutePoint[], center: [number, number]): number {
  const pts = normalizeMapRoutePoints(routePoints);
  if (pts.length < 2) return 0;
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  for (let i = 0; i < pts.length - 1; i++) {
    const midLat = (pts[i].lat + pts[i + 1].lat) / 2;
    const midLng = (pts[i].lng + pts[i + 1].lng) / 2;
    const d = Math.hypot(midLat - center[0], (midLng - center[1]) * Math.cos((center[0] * Math.PI) / 180));
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  const a = pts[best];
  const b = pts[best + 1];
  const dx = (b.lng - a.lng) * Math.cos((a.lat * Math.PI) / 180);
  const dy = b.lat - a.lat;
  const compass = (Math.atan2(dx, dy) * 180) / Math.PI; // 北 = 0、時計回り
  // Leaflet 版は「道の進行方向 + 180」を上にしていたので合わせる
  return ((compass + 180) % 360 + 360) % 360;
}

function shopsToGeoJSON(shops: Shop[], display: ShopDisplayState): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: shops
      .filter((s) => !s.illustration?.customSvg)
      .map((s) => {
        const stall = resolveStallColors(s.category, sanitizeCssColor(s.illustration?.color));
        return {
          type: "Feature",
          id: s.id,
          geometry: { type: "Point", coordinates: [s.lng, s.lat] },
          properties: {
            id: s.id,
            name: s.name,
            spriteKey: stallSpriteKey(s),
            state: display.states.get(s.id) ?? "normal",
            // 道の北側は木札を右（道の外側）、南側は左に出す（Leaflet 版 .shop-side-*）
            side: getRoadSide(s.lat, s.lng),
            favorite: display.favorites.has(s.id),
            bag: display.bags.has(s.id),
            // 屋根の上の丸窓。写真が無ければカテゴリの既定画像
            photo: s.images?.main ?? getShopBannerImage(s.category, s.position ?? s.id),
            photoBorder: stall.dark,
          },
        };
      }),
  };
}

export default function MapViewMapLibre({
  shops: initialShops,
  landmarks,
  mapRoute,
  featureFlags: featureFlagsProp,
  searchShopIds,
  aiShopIds,
  commentShopId,
  onMapReady,
  onMapStage,
  onMapInstance,
  initialShopId,
  trackingButtonTop,
  hideMapUI = false,
  suppressLandmarks = false,
  onUserLocationUpdate,
  suppressInitialLocationFocus = false,
  onClearSearch,
  overlaySlot,
  spotlightShopId,
  onSpotSelect,
  selectedSpotId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // ランドマークのクリックは map.on で一度だけ登録するので、最新のコールバックは ref で持つ
  const onSpotSelectRef = useRef(onSpotSelect);
  onSpotSelectRef.current = onSpotSelect;
  const landmarksRef = useRef(landmarks);
  landmarksRef.current = landmarks;
  // 画像の登録に成功したランドマーク（ソースに載せたもの）。選択の切り替え時に setData で使う
  const landmarkSpecsRef = useRef<Landmark[]>([]);
  // ページ側（「このへん」の出現判定、施設案内の flyTo、ズームスライダー）に渡すカメラ操作
  const [camera, setCamera] = useState<MapCamera | null>(null);
  // ズームスライダーは操作中とその直後だけ出す（Leaflet 版と同じ 3 秒）
  const [zoomSliderVisible, setZoomSliderVisible] = useState(false);
  const zoomSliderHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepZoomSliderAlive = useCallback(() => {
    if (zoomSliderHideTimerRef.current) clearTimeout(zoomSliderHideTimerRef.current);
    setZoomSliderVisible(true);
    zoomSliderHideTimerRef.current = setTimeout(() => setZoomSliderVisible(false), 3000);
  }, []);
  const chomeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [favoriteShopIds, setFavoriteShopIds] = useState<number[]>([]);
  const { addItem, items: bagItems } = useBag();

  const featureFlags = useMemo<MapFeatureFlags>(
    () =>
      resolveMapFeatureFlags(
        featureFlagsProp,
        typeof window === "undefined" ? "" : window.location.search
      ),
    [featureFlagsProp]
  );

  const routePoints = useMemo(() => {
    const normalized = normalizeMapRoutePoints(mapRoute?.points ?? []);
    return normalized.length >= 2 ? normalized : getDefaultMapRoutePoints();
  }, [mapRoute]);
  const routeConfig = useMemo(() => getEffectiveMapRouteConfig(mapRoute?.config), [mapRoute]);

  // 現在地の追従（Leaflet 版と同じく初期値はオン。ユーザーがドラッグしたらオフ）
  const [isTracking, setIsTracking] = useState(true);
  const toggleTracking = useCallback(() => setIsTracking((prev) => !prev), []);
  const handleUserLocationUpdate = useCallback(
    (inMarket: boolean, position: [number, number]) => {
      onUserLocationUpdate?.({ lat: position[0], lng: position[1], inMarket });
    },
    [onUserLocationUpdate]
  );

  // 道への吸着: 中心を道の上へ投影した点を返す。もともと道の上（ずれが小さい）なら null
  const roadSnapModeRef = useRef(featureFlags.roadSnap);
  roadSnapModeRef.current = featureFlags.roadSnap;
  const snapToRoad = useCallback(
    (lat: number, lng: number): [number, number] | null => {
      const projection = projectPointOntoRoute({ lat, lng }, routePoints);
      if (!projection) return null;
      const from = new maplibregl.LngLat(lng, lat);
      const to = new maplibregl.LngLat(projection.point.lng, projection.point.lat);
      if (from.distanceTo(to) < ROAD_SNAP_MIN_DISTANCE_METERS) return null;
      return [projection.point.lat, projection.point.lng];
    },
    [routePoints]
  );
  const snapToRoadRef = useRef(snapToRoad);
  snapToRoadRef.current = snapToRoad;

  const shops = useMemo(() => {
    const real = initialShops ?? [];
    const perfCount =
      typeof window !== "undefined" ? readPerfShopCount(window.location.search) : null;
    return perfCount ? synthesizeShops(real, routePoints, perfCount) : real;
  }, [initialShops, routePoints]);
  const shopsRef = useRef(shops);
  shopsRef.current = shops;

  // ---- 店舗の状態（検索 / AI / 買い物袋 / 選択）→ GeoJSON の state 属性 ----
  const bagShopIds = useMemo(
    () =>
      (bagItems ?? [])
        .map((item) => item.fromShopId)
        .filter((id): id is number => typeof id === "number"),
    [bagItems]
  );
  useEffect(() => {
    setFavoriteShopIds(loadFavoriteShopIds());
    const handler = () => setFavoriteShopIds(loadFavoriteShopIds());
    window.addEventListener(FAVORITE_SHOPS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(FAVORITE_SHOPS_UPDATED_EVENT, handler);
  }, []);

  const shopStates = useMemo<ShopStateMap>(() => {
    const m: ShopStateMap = new Map();
    for (const id of bagShopIds) m.set(id, "bag");
    for (const id of aiShopIds ?? []) m.set(id, "ai");
    for (const id of searchShopIds ?? []) m.set(id, "search");
    if (commentShopId) m.set(commentShopId, "ai");
    if (selectedShop) m.set(selectedShop.id, "selected");
    return m;
  }, [bagShopIds, aiShopIds, searchShopIds, commentShopId, selectedShop]);
  const display = useMemo<ShopDisplayState>(
    () => ({ states: shopStates, favorites: new Set(favoriteShopIds), bags: new Set(bagShopIds) }),
    [shopStates, favoriteShopIds, bagShopIds]
  );
  const displayRef = useRef(display);
  displayRef.current = display;

  const applyShopData = useCallback((next: ShopDisplayState) => {
    const map = mapRef.current;
    const src = map?.getSource(SRC_SHOPS) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(shopsToGeoJSON(shopsRef.current, next));
  }, []);

  useEffect(() => {
    if (!mapLoaded) return;
    applyShopData(display);
  }, [mapLoaded, display, applyShopData]);

  // ---- 地図の初期化 ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const bounds = getRouteBounds(routePoints);
    const center = getRouteCenter(routePoints);
    // 初期中心は「道の範囲の中央に最も近い道の点」。最大ズームで開くので、道の上に乗せないと店舗が画面外になる
    const projected = projectPointOntoRoute({ lat: center[0], lng: center[1] }, routePoints);
    const nearestRoutePoint = routePoints.reduce(
      (best, p) => {
        const d = Math.hypot(p.lat - center[0], (p.lng - center[1]) * Math.cos((center[0] * Math.PI) / 180));
        return d < best.d ? { d, p } : best;
      },
      { d: Number.POSITIVE_INFINITY, p: routePoints[0] }
    ).p;
    // 射影点は道からずれることがあったので、確実に道の上にある頂点を使う
    void projected;
    const initialCenter: [number, number] = [nearestRoutePoint.lng, nearestRoutePoint.lat];
    // 可動範囲。MapLibre の maxBounds は「範囲が画面に収まる倍率まで」しか縮小できなくなるので、
    // 最小ズーム（市場全体が見える倍率）まで引けるよう Leaflet 版より広めに取る
    const maxBounds = expandBoundsByMeters(bounds, Math.max(routeConfig.visibleDistanceMeters + 48, 120) + 600);
    // [[lat, lng], [lat, lng]] の並び順に依存せず、南西・北東を最小・最大から組み立てる
    const lats = [maxBounds[0][0], maxBounds[1][0]];
    const lngs = [maxBounds[0][1], maxBounds[1][1]];
    const maxBoundsLngLat: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    const useVector = featureFlags.basemap === "vector-openfreemap";
    const map = new maplibregl.Map({
      container,
      style: useVector ? OPENFREEMAP_STYLE_URL : buildRasterStyle(featureFlags.tileOpacityByZoom),
      center: initialCenter,
      zoom: INITIAL_ZOOM,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      bearing: computeRoadBearing(routePoints, center),
      pitch: 0,
      maxBounds: maxBoundsLngLat,
      attributionControl: { compact: true },
      // 傾き（3D）は日曜市の案内には不要
      touchPitch: false,
      pitchWithRotate: false,
      fadeDuration: 0,
    });
    map.touchZoomRotate.enableRotation();
    map.dragRotate.enable();
    // MapLibre 標準のズーム・コンパスボタンは出さない（ズームはスライダー、回転は 2 本指操作で行う）
    mapRef.current = map;

    let disposed = false;
    let readyTimer: number | null = null;

    // ローディングのゲージ用。スタイルを読み終えた時点を最初の節目として報告する
    map.once("styledata", () => {
      if (!disposed) onMapStage?.("style");
    });

    map.on("load", async () => {
      if (disposed) return;
      try {
        await setupOverlays();
      } catch (error) {
        console.error("[MapViewMapLibre] 初期化に失敗しました", error);
      }
      if (disposed) return;
      setMapLoaded(true);
      onMapStage?.("loaded");
      // ページ側の部品に渡すカメラ操作（ズーム値は Leaflet 換算に揃える）
      const cameraAdapter: MapCamera & { [MAPLIBRE_MAP_KEY]: maplibregl.Map } = {
        getContainer: () => map.getContainer(),
        getCenter: () => {
          const c = map.getCenter();
          return { lat: c.lat, lng: c.lng };
        },
        getZoom: () => map.getZoom() - ZOOM_OFFSET,
        getMaxZoom: () => map.getMaxZoom() - ZOOM_OFFSET,
        setZoom: (zoom, options) => {
          const target = zoom + ZOOM_OFFSET;
          if (options?.animate === false) {
            map.setZoom(target);
            return;
          }
          // integrated: アニメーション付きの拡大は、目標中心をあらかじめ道の上に差し替えて 1 回の動きで済ませる
          // （MapLibre は中心とズームを同時に動かせるので Leaflet 版のような画面内チェックは不要）
          if (roadSnapModeRef.current === "integrated" && target > map.getZoom() + 0.01) {
            const c = map.getCenter();
            const snapped = snapToRoadRef.current(c.lat, c.lng);
            if (snapped) {
              map.easeTo({ zoom: target, center: [snapped[1], snapped[0]], duration: 250 });
              return;
            }
          }
          map.zoomTo(target, { duration: 250 });
        },
        flyTo: (latlng, zoom, options) => {
          map.flyTo({
            center: [latlng[1], latlng[0]],
            zoom: zoom === undefined ? undefined : zoom + ZOOM_OFFSET,
            duration: options?.animate === false ? 0 : (options?.duration ?? 0.8) * 1000,
          });
        },
        setView: (center, zoom, options) => {
          const target = {
            center: [center[1], center[0]] as [number, number],
            zoom: zoom === undefined ? undefined : zoom + ZOOM_OFFSET,
          };
          if (options?.animate === false) map.jumpTo(target);
          else map.easeTo({ ...target, duration: (options?.duration ?? 0.6) * 1000 });
        },
        // MapLibre 専用レイヤー（施設案内など）を載せる部品が生の map を取り出せるようにする
        [MAPLIBRE_MAP_KEY]: map,
        latLngToContainerPoint: (latlng) => {
          const p = map.project([latlng[1], latlng[0]]);
          return { x: p.x, y: p.y };
        },
        containerPointToLatLng: (point) => {
          const xy: [number, number] = Array.isArray(point) ? point : [point.x, point.y];
          const ll = map.unproject(xy);
          return { lat: ll.lat, lng: ll.lng };
        },
        distance: (a, b) => {
          const toLngLat = (v: { lat: number; lng: number } | [number, number]) =>
            Array.isArray(v) ? new maplibregl.LngLat(v[1], v[0]) : new maplibregl.LngLat(v.lng, v.lat);
          return toLngLat(a).distanceTo(toLngLat(b));
        },
        on: (event: MapCameraEvent, handler) => map.on(event, handler),
        off: (event: MapCameraEvent, handler) => map.off(event, handler),
      };
      setCamera(cameraAdapter);
      onMapInstance?.(cameraAdapter);
      // ズーム操作中はスライダーを出す
      map.on("zoomstart", keepZoomSliderAlive);
      map.on("zoom", keepZoomSliderAlive);
      // ユーザーが地図を動かしたら追従をやめる
      map.on("dragstart", () => setIsTracking(false));
      // ローディングを畳むのはタイルやグリフまで描き終えた（idle）とき。
      // タブが裏にあると idle が来ないことがあるので、load から少し待ったら畳む
      let readyReported = false;
      const reportReady = () => {
        if (disposed || readyReported) return;
        readyReported = true;
        if (readyTimer !== null) {
          window.clearTimeout(readyTimer);
          readyTimer = null;
        }
        onMapReady?.();
      };
      map.once("idle", reportReady);
      readyTimer = window.setTimeout(reportReady, 2500);
    });

    const setupOverlays = async () => {

      // ベクター背景は施設名などのラベルが自前の丁目バッジと重なるので、POI を消す
      if (useVector) {
        for (const layer of map.getStyle().layers ?? []) {
          if (layer.type === "symbol" && /poi|place|housenumber/.test(layer.id)) {
            map.setLayoutProperty(layer.id, "visibility", "none");
          }
        }
      }

      // 市場の色かぶせ
      if (featureFlags.backgroundOverlay !== "off") {
        map.addSource(SRC_TINT, { type: "image", url: MARKET_TINT_URL, coordinates: MARKET_TINT_COORDS });
        map.addLayer({ id: "nicchyo-tint", type: "raster", source: SRC_TINT, paint: { "raster-opacity": 1, "raster-fade-duration": 0 } });
      }

      // 道（Leaflet 版 DynamicRoad と同じ形・色）
      const chains = getRouteChains(routePoints);
      const polygons: GeoJSON.Feature[] = [];
      const centerlines: GeoJSON.Feature[] = [];
      for (const chain of chains) {
        const anchor = chain.points.map((p) => ({ lat: p.lat, lng: p.lng }));
        const centerline = densifyPath(anchor, 6);
        const smoothed = chain.points.length >= 3 ? smoothRoutePath(centerline, 2) : centerline;
        const polygon = buildRoadPolygon(smoothed, routeConfig.roadHalfWidthMeters);
        if (polygon.length < 3 || smoothed.length < 2) continue;
        polygons.push({
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [[...polygon, polygon[0]].map(([lat, lng]) => [lng, lat])] },
        });
        centerlines.push({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: smoothed.map(([lat, lng]) => [lng, lat]) },
        });
      }
      map.addSource(SRC_ROAD, { type: "geojson", data: { type: "FeatureCollection", features: polygons } });
      map.addSource(`${SRC_ROAD}-center`, { type: "geojson", data: { type: "FeatureCollection", features: centerlines } });
      map.addLayer({ id: "nicchyo-road-fill", type: "fill", source: SRC_ROAD, paint: { "fill-color": "#d4c5b0", "fill-opacity": 1 } });
      map.addLayer({
        id: "nicchyo-road-overview-tint",
        type: "fill",
        source: SRC_ROAD,
        maxzoom: OVERVIEW_MAX,
        paint: { "fill-color": "#22c55e", "fill-opacity": 0.36 },
      });
      map.addLayer({
        id: "nicchyo-road-outline",
        type: "line",
        source: SRC_ROAD,
        layout: { "line-cap": "round" },
        paint: { "line-color": "#c2820a", "line-width": 1.5, "line-opacity": 0.38, "line-dasharray": [6.7, 4] },
      });
      map.addLayer({
        id: "nicchyo-road-centerline",
        type: "line",
        source: `${SRC_ROAD}-center`,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#a89070", "line-width": 1, "line-opacity": 0.5 },
      });

      // お客さん（人影）。道の上にまばらに散らして「にぎわい」を出す。
      // 店舗より下のレイヤーに置き、不透明度を落として背景に沈める。
      // クリックハンドラは付けない（触れるものが増えると「主役は屋台」の原則が崩れる）
      if (featureFlags.crowd === "sprite") {
        const crowdRatio = Math.min(3, window.devicePixelRatio || 2);
        const crowdSprites = await buildCrowdSprites(crowdRatio);
        if (disposed) return;
        for (const sprite of crowdSprites) {
          if (!map.hasImage(sprite.id)) {
            map.addImage(sprite.id, sprite.image, { pixelRatio: sprite.pixelRatio });
          }
        }
        const people = buildCrowdPeople(routePoints, {
          halfWidthMeters: routeConfig.roadHalfWidthMeters,
        });
        map.addSource(SRC_CROWD, { type: "geojson", data: crowdToGeoJSON(people) });
        map.addLayer({
          id: LAYER_CROWD,
          type: "symbol",
          source: SRC_CROWD,
          // 屋台が出るズームから。俯瞰では点にしかならないので出さない
          minzoom: OVERVIEW_MAX,
          layout: {
            "icon-image": crowdIconImage(0),
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              MAX_ZOOM + SHOP_MARKER_LOD_OFFSETS.stall,
              0.6,
              MAX_ZOOM,
              1,
            ],
            "icon-anchor": "bottom",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-rotation-alignment": "viewport",
          },
          // 背景として沈ませる（濃いと屋台と主役争いになる）
          paint: { "icon-opacity": 0.72 },
        });
      }

      // ランドマーク画像（ズームに応じて 1.22^(z-18) 倍、Leaflet 版と同じ式）。
      // SVG も混ざるので、表示幅 × pixelRatio で描き起こしてから登録する
      const specs = landmarks ?? [];
      const landmarkRatio = Math.min(3, window.devicePixelRatio || 2);
      await Promise.all(
        specs.map(async (spec) => {
          try {
            const data = await rasterizeImageUrl(spec.url, spec.widthPx, landmarkRatio);

            if (!map.hasImage(`landmark:${spec.key}`)) {
              map.addImage(`landmark:${spec.key}`, data, { pixelRatio: landmarkRatio });
            }
          } catch (error) {
            console.warn("[MapViewMapLibre] ランドマーク画像を読めませんでした", spec.key, error);
          }
        })
      );
      if (disposed) return;
      // 選択中（スポットカード表示中）のランドマークは properties.selected を 1 にして
      // 拡大する。layout プロパティでは feature-state が使えないので、選択が変わるたびに
      // setData で属性ごと差し替える（buildLandmarkFeatures を共有）
      landmarkSpecsRef.current = specs.filter((spec) => map.hasImage(`landmark:${spec.key}`));
      map.addSource(SRC_LANDMARKS, {
        type: "geojson",
        data: buildLandmarkFeatures(landmarkSpecsRef.current, null),
      });
      // 画像は表示幅で登録済みなので、倍率は 1.22^(z-18) だけ（0.5〜2.8 に制限）。
      // スポットカードで選択中のランドマークは 1.18 倍にして目立たせる
      // （"zoom" は interpolate の直下でしか使えないので、選択倍率は各出力側に掛ける）
      const selectedScale: ExpressionSpecification = [
        "case",
        ["==", ["get", "selected"], 1],
        1.18,
        1,
      ];
      const landmarkSize: ExpressionSpecification = [
        "interpolate",
        ["exponential", 1.22],
        ["zoom"],
        13.5,
        ["*", 0.5, selectedScale],
        17,
        selectedScale,
        20,
        ["*", 1.816, selectedScale],
      ];
      const landmarkLayout = {
        "icon-image": ["get", "image"] as ExpressionSpecification,
        "icon-size": landmarkSize,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
        "icon-rotation-alignment": "viewport" as const,
      };
      // 最小ズーム付近は showAtMinZoom の建物だけ、それ以上は全部
      map.addLayer({
        id: "nicchyo-landmarks-min",
        type: "symbol",
        source: SRC_LANDMARKS,
        maxzoom: MIN_ZOOM + 0.8,
        filter: ["==", ["get", "showAtMinZoom"], 1],
        layout: landmarkLayout,
      });
      map.addLayer({
        id: "nicchyo-landmarks",
        type: "symbol",
        source: SRC_LANDMARKS,
        minzoom: MIN_ZOOM + 0.8,
        layout: landmarkLayout,
      });
      // ランドマークのタップ → スポットカード（店舗バナーは閉じる）
      const handleLandmarkClick = (e: maplibregl.MapLayerMouseEvent) => {
        const key = e.features?.[0]?.properties?.key;
        if (typeof key !== "string") return;
        const landmark = landmarksRef.current?.find((spec) => spec.key === key);
        if (!landmark) return;
        setSelectedShop(null);
        onSpotSelectRef.current?.(landmarkToSpot(landmark));
      };
      for (const layerId of ["nicchyo-landmarks-min", "nicchyo-landmarks"]) {
        map.on("click", layerId, handleLandmarkClick);
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }
      // 地名ラベル（俯瞰時 zoom ≤ MIN+2.5 だけ。Leaflet 版の主要地名ラベルに相当）
      map.addLayer({
        id: LAYER_LANDMARK_LABELS,
        type: "symbol",
        source: SRC_LANDMARKS,
        maxzoom: MIN_ZOOM + 2.5,
        layout: {
          "text-field": ["get", "name"],
          "text-font": TEXT_FONT,
          "text-size": 12,
          "text-anchor": "top",
          "text-offset": [0, 1.6],
          "text-rotation-alignment": "viewport",
          "text-pitch-alignment": "viewport",
        },
        paint: {
          "text-color": "#3a3a3a",
          "text-halo-color": "rgba(255,255,255,0.92)",
          "text-halo-width": 1.6,
        },
      });

      // 店舗スプライト
      const sprites = await buildStallSprites(shopsRef.current, Math.min(3, window.devicePixelRatio || 2));
      if (disposed) return;
      for (const sprite of sprites) {
        if (!map.hasImage(sprite.id)) map.addImage(sprite.id, sprite.image, { pixelRatio: sprite.pixelRatio });
      }
      // バッジと木札の下地
      const uiRatio = Math.min(3, window.devicePixelRatio || 2);
      if (!map.hasImage(IMG_BADGE_FAVORITE)) {
        map.addImage(IMG_BADGE_FAVORITE, buildBadgeSprite("favorite", uiRatio), { pixelRatio: uiRatio });
      }
      if (!map.hasImage(IMG_BADGE_BAG)) {
        map.addImage(IMG_BADGE_BAG, buildBadgeSprite("bag", uiRatio), { pixelRatio: uiRatio });
      }
      if (!map.hasImage(IMG_NAMEPLATE)) {
        const plate = buildNameplateSprite(uiRatio);
        map.addImage(IMG_NAMEPLATE, plate.image, {
          pixelRatio: uiRatio,
          stretchX: plate.stretchX,
          stretchY: plate.stretchY,
          content: plate.content,
        });
      }

      // 屋根の上の丸窓（写真）は店舗ごとに違うので、必要になった時点で遅延生成する
      const photoJobs = new Map<string, Promise<void>>();
      map.on("styleimagemissing", (e) => {
        const id = e.id;
        if (!id.startsWith("photo:") || photoJobs.has(id)) return;
        const shopId = Number(id.slice("photo:".length));
        const shop = shopsRef.current.find((s) => s.id === shopId);
        if (!shop) return;
        const url = shop.images?.main ?? getShopBannerImage(shop.category, shop.position ?? shop.id);
        const border = resolveStallColors(shop.category, sanitizeCssColor(shop.illustration?.color)).dark;
        // 同じ大きさの透明な仮画像を同期で登録しておく（無いままだと MapLibre が警告を出す）。
        // 読み込めたら updateImage で中身だけ差し替える
        const placeholderSize = Math.round((PHOTO_SIZE_PX + 8) * uiRatio);
        if (!map.hasImage(id)) {
          map.addImage(id, new ImageData(placeholderSize, placeholderSize), { pixelRatio: uiRatio });
        }
        photoJobs.set(
          id,
          rasterizePhotoCircle(url, PHOTO_SIZE_PX, border, uiRatio)
            .then((data) => {
              if (!disposed && map.hasImage(id)) map.updateImage(id, data);
            })
            .catch(() => {
              /* 読めない写真は窓を出さない（透明のまま） */
            })
        );
      });

      map.addSource(SRC_SHOPS, {
        type: "geojson",
        data: shopsToGeoJSON(shopsRef.current, displayRef.current),
        promoteId: "id",
      });
      const stallScale: ExpressionSpecification = [
        "interpolate",
        ["linear"],
        ["zoom"],
        MAX_ZOOM + SHOP_MARKER_LOD_OFFSETS.stall,
        0.6,
        MAX_ZOOM,
        1,
      ];
      map.addLayer({
        id: LAYER_SHOPS,
        type: "symbol",
        source: SRC_SHOPS,
        minzoom: OVERVIEW_MAX,
        layout: {
          "icon-image": ["concat", "stall:", ["get", "spriteKey"], ":", ["get", "state"]],
          "icon-size": stallScale,
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotation-alignment": "viewport",
          "symbol-sort-key": ["case", ["==", ["get", "state"], "selected"], 0, 1],
        },
      });

      // 写真窓: photo LOD（maxZoom-1.4）以上。屋台の内側、木札と反対の側に寄せる
      map.addLayer({
        id: LAYER_SHOP_PHOTOS,
        type: "symbol",
        source: SRC_SHOPS,
        minzoom: MAX_ZOOM + SHOP_MARKER_LOD_OFFSETS.photo,
        layout: {
          "icon-image": ["concat", "photo:", ["get", "id"]],
          "icon-size": stallScale,
          "icon-anchor": "center",
          "icon-offset": ["case", ["==", ["get", "side"], "north"], ["literal", [-24, -30]], ["literal", [24, -30]]],
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
          "icon-rotation-alignment": "viewport",
        },
      });

      // 木札（店名）: nameplate LOD（maxZoom-0.8）以上。道の外側へ出し、重なるものは自動で間引く
      map.addLayer({
        id: LAYER_SHOP_NAMEPLATES,
        type: "symbol",
        source: SRC_SHOPS,
        minzoom: MAX_ZOOM + SHOP_MARKER_LOD_OFFSETS.nameplate,
        layout: {
          "text-field": ["get", "name"],
          "text-font": TEXT_FONT,
          "text-size": 11,
          "text-max-width": 9,
          "text-anchor": ["case", ["==", ["get", "side"], "north"], "left", "right"],
          "text-offset": ["case", ["==", ["get", "side"], "north"], ["literal", [3.2, -2.4]], ["literal", [-3.2, -2.4]]],
          "text-rotation-alignment": "viewport",
          "text-pitch-alignment": "viewport",
          "icon-image": IMG_NAMEPLATE,
          "icon-text-fit": "both",
          "icon-text-fit-padding": [3, 8, 3, 8],
          "icon-rotation-alignment": "viewport",
          "symbol-sort-key": ["case", ["==", ["get", "state"], "selected"], 0, 1],
        },
        paint: { "text-color": "#4a3826" },
      });

      // お気に入り・買い物袋バッジ（Leaflet 版と同じく photo LOD 以上で右上に）
      for (const [layerId, imageId, prop] of [
        [LAYER_SHOP_BADGES_FAVORITE, IMG_BADGE_FAVORITE, "favorite"],
        [LAYER_SHOP_BADGES_BAG, IMG_BADGE_BAG, "bag"],
      ] as const) {
        map.addLayer({
          id: layerId,
          type: "symbol",
          source: SRC_SHOPS,
          minzoom: MAX_ZOOM + SHOP_MARKER_LOD_OFFSETS.photo,
          filter: ["==", ["get", prop], true],
          layout: {
            "icon-image": imageId,
            "icon-size": stallScale,
            "icon-anchor": "center",
            "icon-offset": ["case", ["==", ["get", "side"], "north"], ["literal", [-30, -66]], ["literal", [30, -66]]],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-rotation-alignment": "viewport",
          },
        });
      }

      map.on("click", LAYER_SHOPS, (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id;
        if (typeof id !== "number") return;
        const shop = shopsRef.current.find((s) => s.id === id) ?? null;
        setSelectedShop(shop);
      });
      map.on("mouseenter", LAYER_SHOPS, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_SHOPS, () => {
        map.getCanvas().style.cursor = "";
      });

      // 丁目バッジ（HTML マーカー、17 ≤ zoom < 19 のときだけ表示）
      const chomeGroups = new Map<string, { lats: number[]; lngs: number[] }>();
      for (const s of shopsRef.current) {
        if (!s.chome) continue;
        const g = chomeGroups.get(s.chome) ?? { lats: [], lngs: [] };
        g.lats.push(s.lat);
        g.lngs.push(s.lng);
        chomeGroups.set(s.chome, g);
      }
      chomeMarkersRef.current = Array.from(chomeGroups.entries()).map(([chome, g]) => {
        const lat = g.lats.reduce((a, b) => a + b, 0) / g.lats.length;
        const lng = g.lngs.reduce((a, b) => a + b, 0) / g.lngs.length;
        const el = document.createElement("div");
        el.className = "chome-area-badge";
        el.innerHTML =
          `<div class="chome-area-kanji">${CHOME_KANJI[chome] ?? chome[0]}</div>` +
          `<div class="chome-area-sublabel">丁目</div>` +
          `<div class="chome-area-count">${g.lats.length}店</div>`;
        el.addEventListener("click", () => {
          map.flyTo({ center: [lng, lat], zoom: OVERVIEW_MAX + 0.2, duration: 600 });
        });
        return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
      });
      const updateChomeVisibility = () => {
        const z = map.getZoom();
        const visible = z >= OVERVIEW_MIN && z < OVERVIEW_MAX;
        for (const m of chomeMarkersRef.current) {
          m.getElement().style.display = visible ? "" : "none";
        }
      };
      updateChomeVisibility();
      map.on("zoom", updateChomeVisibility);

      if (initialShopId) {
        const target = shopsRef.current.find((s) => s.id === initialShopId);
        if (target) map.jumpTo({ center: [target.lng, target.lat], zoom: MAX_ZOOM });
      }
    };

    return () => {
      disposed = true;
      if (readyTimer !== null) window.clearTimeout(readyTimer);
      chomeMarkersRef.current.forEach((m) => m.remove());
      chomeMarkersRef.current = [];
      setMapLoaded(false);
      map.remove();
      mapRef.current = null;
    };
    // 初期化は 1 回だけ（フラグや道データの変更はページの再読み込みで反映する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 道への吸着（after、および integrated のホイール・ピンチ分）:
  // 拡大が終わったら少し待って、中心を道の上へパンで寄せる。
  // MapLibre ではホイール・ピンチのズームに割り込めないので、integrated でもここで寄せる
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (featureFlags.roadSnap === "off") return;
    let lastZoom = map.getZoom();
    let timer: number | null = null;
    const clearSnapTimer = () => {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    };
    const handleZoomEnd = () => {
      const nextZoom = map.getZoom();
      const zoomingIn = nextZoom > lastZoom + 0.01;
      lastZoom = nextZoom;
      if (!zoomingIn) return;
      clearSnapTimer();
      timer = window.setTimeout(() => {
        timer = null;
        const c = map.getCenter();
        const snapped = snapToRoad(c.lat, c.lng);
        if (!snapped) return;
        map.easeTo({ center: [snapped[1], snapped[0]], duration: 350 });
      }, ROAD_SNAP_DELAY_MS);
    };
    map.on("zoomstart", clearSnapTimer);
    map.on("dragstart", clearSnapTimer);
    map.on("zoomend", handleZoomEnd);
    return () => {
      clearSnapTimer();
      map.off("zoomstart", clearSnapTimer);
      map.off("dragstart", clearSnapTimer);
      map.off("zoomend", handleZoomEnd);
    };
  }, [mapLoaded, featureFlags.roadSnap, snapToRoad]);

  // 人影の歩き（2 コマ）。何体いても setLayoutProperty は 1 回で済むのでコストは一定。
  // 裏タブのときは動かさない（見えないコマ送りに電池を使わない）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    if (featureFlags.crowd !== "sprite") return;
    if (!map.getLayer(LAYER_CROWD)) return;
    let frame = 0;
    const timer = window.setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (!map.getLayer(LAYER_CROWD)) return;
      frame = (frame + 1) % CROWD_FRAME_COUNT;
      map.setLayoutProperty(LAYER_CROWD, "icon-image", crowdIconImage(frame));
    }, CROWD_FRAME_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [mapLoaded, featureFlags.crowd]);

  // スポットカードで選択中のランドマークを拡大する（properties.selected を差し替える）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const source = map.getSource(SRC_LANDMARKS) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const key = selectedSpotId?.startsWith("landmark:") ? selectedSpotId.slice("landmark:".length) : null;
    source.setData(buildLandmarkFeatures(landmarkSpecsRef.current, key));
  }, [mapLoaded, selectedSpotId]);

  // おでかけサポート案内中は FacilityLayer が案内先を表示するため、通常のランドマークは隠す
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    const visibility = suppressLandmarks ? "none" : "visible";
    for (const id of ["nicchyo-landmarks-min", "nicchyo-landmarks", LAYER_LANDMARK_LABELS]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visibility);
    }
  }, [mapLoaded, suppressLandmarks]);

  // ---- 計測の橋渡し（?perf=1 のときだけ） ----
  useEffect(() => {
    if (!mapLoaded) return;
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("perf") !== "1") return;
    const map = mapRef.current;
    if (!map) return;

    const adapter: BenchMapLike = {
      getZoom: () => map.getZoom(),
      getMinZoom: () => map.getMinZoom(),
      getMaxZoom: () => map.getMaxZoom(),
      setZoom: (zoom, options) => {
        if (options?.animate === false) map.setZoom(zoom);
        else map.zoomTo(zoom, { duration: 250 });
      },
      panBy: (offset, options) => {
        map.panBy(offset, { duration: options?.animate === false ? 0 : (options?.duration ?? 0.6) * 1000 });
      },
      once: (event, handler) => map.once(event as "zoomend", handler),
      off: (event, handler) => map.off(event as "zoomend", handler),
      getContainer: () => map.getContainer(),
      setHighlightAll: (on) => {
        const states: ShopStateMap = new Map();
        if (on) for (const s of shopsRef.current) states.set(s.id, "search");
        applyShopData({ ...displayRef.current, states });
        return shopsRef.current.length;
      },
    };
    window.__nicchyoMapBench = {
      run: async (onProgress) => {
        const report = await runFullBenchmark(adapter, onProgress);
        return { ...report, flags: { ...featureFlags } };
      },
      domStats: () => ({
        markerPaneElements: 0,
        markerCount: 0,
        elementsPerMarker: 0,
        documentElements: document.querySelectorAll("*").length,
        jsHeapMb: null,
      }),
      zoomTo: (zoom) => map.zoomTo(zoom, { duration: 250 }),
      getZoom: () => map.getZoom(),
    };
    // 計測・デバッグ用に Map 本体も公開する（?perf=1 のときだけ）
    (window as unknown as { __nicchyoMapLibre?: maplibregl.Map }).__nicchyoMapLibre = map;
    window.dispatchEvent(new Event("nicchyo-map-bench-ready"));
    return () => {
      delete window.__nicchyoMapBench;
      delete (window as unknown as { __nicchyoMapLibre?: maplibregl.Map }).__nicchyoMapLibre;
    };
  }, [mapLoaded, featureFlags, applyShopData]);

  // 検索結果シート: 検索結果を優先し、無ければ AI おすすめ
  const activeHighlightShopIds = useMemo(() => {
    if (searchShopIds && searchShopIds.length > 0) return searchShopIds;
    if (aiShopIds && aiShopIds.length > 0) return aiShopIds;
    return undefined;
  }, [aiShopIds, searchShopIds]);
  const resultsBadgeBottom = overlaySlot
    ? "calc(4.5rem + env(safe-area-inset-bottom,0px) + 5.5rem + 25px)"
    : "calc(4.5rem + env(safe-area-inset-bottom,0px) + 0.5rem + 25px)";

  const handleAddToBag = useCallback(
    (name: string, fromShopId?: number) => {
      const value = name.trim();
      if (!value) return;
      addItem({ name: value, fromShopId });
    },
    [addItem]
  );

  return (
    <div className="relative h-full w-full">
      {/* maplibre-gl.css が .maplibregl-map に position:relative を当てるので、サイズはインラインで明示する */}
      <div
        ref={containerRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#FFFAF0" }}
      />
      <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-full bg-white/85 px-3 py-1 text-xs font-semibold text-slate-600 shadow">
        MapLibre 版（検証中） / 背景: {featureFlags.basemap === "vector-openfreemap" ? "ベクター" : "ラスター"}
      </div>
      {!hideMapUI && camera && (
        <LiveZoomMapControls
          map={camera}
          isTracking={isTracking}
          onToggleTracking={toggleTracking}
          minZoom={MIN_ZOOM - ZOOM_OFFSET}
          maxZoom={MAX_ZOOM - ZOOM_OFFSET}
          zoomSliderVisible={zoomSliderVisible}
          onZoomSliderInteract={keepZoomSliderAlive}
          trackingButtonTop={trackingButtonTop}
        />
      )}
      {/* 現在地（道の上にいるときだけ表示。追従中は位置更新で中心を合わせる） */}
      <MapLibreUserLocation
        map={mapLoaded ? mapRef.current : null}
        zoomOffset={ZOOM_OFFSET}
        onLocationUpdate={handleUserLocationUpdate}
        isTracking={isTracking}
        suppressInitialFocus={suppressInitialLocationFocus}
        routePoints={routePoints}
        routeConfig={routeConfig}
      />

      {spotlightShopId && <SpotlightCountdownBar shopId={spotlightShopId} />}

      {activeHighlightShopIds && activeHighlightShopIds.length > 0 && (
        <SearchResultsSheet
          shops={shops}
          searchShopIds={activeHighlightShopIds}
          map={camera}
          onClearSearch={onClearSearch}
          badgeBottom={resultsBadgeBottom}
        />
      )}

      {/* ページ側から差し込む UI（「このへん、なにがある？」のパネル、AI 相談など） */}
      {overlaySlot}

      {selectedShop && (
        <ShopDetailBanner
          key={selectedShop.id}
          shop={selectedShop}
          onClose={() => setSelectedShop(null)}
          onAddToBag={handleAddToBag}
          reserveBottomNavSpace={false}
        />
      )}
    </div>
  );
}
