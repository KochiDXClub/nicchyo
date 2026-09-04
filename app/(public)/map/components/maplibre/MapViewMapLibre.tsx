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
 * - ランドマーク画像、丁目バッジ（HTML マーカー）、店舗タップで詳細バナー
 * - 回転・ピンチ・ドラッグは MapLibre 標準（自作ジェスチャー不要）
 * - 計測の橋渡し（?perf=1 で window.__nicchyoMapBench）
 *
 * 【まだ無いもの（Leaflet 版にある）】
 * 木札（店名）と写真窓、お気に入り・買い物袋バッジ、地名ラベル、道への吸着、
 * 現在地マーカー、AI アシスタント、検索結果シート、ズームスライダー。
 * これらは並走検証で数字が出てから順に移す。
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
import type { MapRoutePoint } from "../../types/mapRoute";
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
import {
  OVERVIEW_ZONE_MAX_ZOOM,
  OVERVIEW_ZONE_MIN_ZOOM,
  SHOP_MARKER_LOD_OFFSETS,
} from "../../config/displayConfig";
import { buildStallSprites, rasterizeImageUrl, stallSpriteKey, type StallState } from "./stallSprites";

const ZOOM_BOUNDS = getRecommendedZoomBounds();
const MIN_ZOOM = ZOOM_BOUNDS.min;
const MAX_ZOOM = ZOOM_BOUNDS.max;
const INITIAL_ZOOM = MAX_ZOOM;

const CARTO_TILES = ["a", "b", "c", "d"].map(
  (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png`
);
const CARTO_ATTRIBUTION =
  '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

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
const LAYER_SHOPS = "nicchyo-shops";

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

function shopsToGeoJSON(shops: Shop[], states: ShopStateMap): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: shops
      .filter((s) => !s.illustration?.customSvg)
      .map((s) => ({
        type: "Feature",
        id: s.id,
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: {
          id: s.id,
          name: s.name,
          spriteKey: stallSpriteKey(s),
          state: states.get(s.id) ?? "normal",
        },
      })),
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
  initialShopId,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
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
  // お気に入りバッジは第 1 段階では未実装。参照だけ残す
  void favoriteShopIds;

  const applyShopData = useCallback((states: ShopStateMap) => {
    const map = mapRef.current;
    const src = map?.getSource(SRC_SHOPS) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    src.setData(shopsToGeoJSON(shopsRef.current, states));
  }, []);

  useEffect(() => {
    if (!mapLoaded) return;
    applyShopData(shopStates);
  }, [mapLoaded, shopStates, applyShopData]);

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
    const initialCenter: [number, number] = projected?.point
      ? [projected.point.lng, projected.point.lat]
      : [nearestRoutePoint.lng, nearestRoutePoint.lat];
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
      style: useVector ? OPENFREEMAP_STYLE : buildRasterStyle(featureFlags.tileOpacityByZoom),
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
    map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: false }), "top-right");
    mapRef.current = map;

    let disposed = false;

    map.on("load", async () => {
      if (disposed) return;
      try {
        await setupOverlays();
      } catch (error) {
        console.error("[MapViewMapLibre] 初期化に失敗しました", error);
      }
      if (disposed) return;
      setMapLoaded(true);
      onMapReady?.();
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
        maxzoom: OVERVIEW_ZONE_MAX_ZOOM,
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
      map.addSource(SRC_LANDMARKS, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: specs
            .filter((spec) => map.hasImage(`landmark:${spec.key}`))
            .map((spec) => ({
              type: "Feature",
              properties: {
                image: `landmark:${spec.key}`,
                showAtMinZoom: spec.showAtMinZoom ? 1 : 0,
              },
              geometry: { type: "Point", coordinates: [spec.lng, spec.lat] },
            })),
        },
      });
      // 画像は表示幅で登録済みなので、倍率は 1.22^(z-18) だけ（0.5〜2.8 に制限）
      const landmarkSize: ExpressionSpecification = [
        "interpolate",
        ["exponential", 1.22],
        ["zoom"],
        14.5,
        0.5,
        18,
        1,
        21,
        1.816,
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

      // 店舗スプライト
      const sprites = await buildStallSprites(shopsRef.current, Math.min(3, window.devicePixelRatio || 2));
      if (disposed) return;
      for (const sprite of sprites) {
        if (!map.hasImage(sprite.id)) map.addImage(sprite.id, sprite.image, { pixelRatio: sprite.pixelRatio });
      }
      map.addSource(SRC_SHOPS, {
        type: "geojson",
        data: shopsToGeoJSON(shopsRef.current, new Map()),
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
        minzoom: OVERVIEW_ZONE_MAX_ZOOM,
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
          map.flyTo({ center: [lng, lat], zoom: OVERVIEW_ZONE_MAX_ZOOM + 0.2, duration: 600 });
        });
        return new maplibregl.Marker({ element: el, anchor: "center" }).setLngLat([lng, lat]).addTo(map);
      });
      const updateChomeVisibility = () => {
        const z = map.getZoom();
        const visible = z >= OVERVIEW_ZONE_MIN_ZOOM && z < OVERVIEW_ZONE_MAX_ZOOM;
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
      chomeMarkersRef.current.forEach((m) => m.remove());
      chomeMarkersRef.current = [];
      setMapLoaded(false);
      map.remove();
      mapRef.current = null;
    };
    // 初期化は 1 回だけ（フラグや道データの変更はページの再読み込みで反映する）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        applyShopData(states);
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
