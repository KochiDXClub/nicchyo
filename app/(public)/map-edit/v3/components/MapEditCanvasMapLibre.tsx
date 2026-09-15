"use client";

/**
 * 管理画面マップ編集の MapLibre 版キャンバス（Issue #650 PR①）。
 *
 * 旧 `MapEditCanvas.tsx`（Leaflet背景＋自前SVGキャンバス）と同じ役割を、公開マップと
 * 同じ MapLibre 上に描き直したもの。背景・区画・道・建物が同じ地図の上に乗るため、
 * 投影方式の違いによる位置ずれ（#490）が構造上なくなる。
 *
 * このPR①では表示・選択・カメラ操作までを実装する。道の新規描画・頂点編集・建物の
 * ドラッグ移動は次のPRで追加する（`handlers` の該当メソッドは型としては残すが呼ばない）。
 *
 * MapEditClientV3 が持つカメラ状態（focus/zoomIdx/rotation）は変えず、MapLibreの
 * center/zoom/bearingとの相互変換は mapEditCamera.ts に閉じ込めている。
 */

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/map/maplibreWorker";
import { buildRoadPolygon } from "../../../map/utils/mapRouteGeometry";
import type { Projection } from "../geo";
import {
  MAPLIBRE_ZOOMS,
  bearingToRotation,
  nearestZoomIdx,
  rotationToBearing,
  zoomIdxToMapLibreZoom,
} from "../mapEditCamera";
import type {
  EditableLandmark,
  EditableRoad,
  EditableShop,
  RoadAction,
  SlotAction,
  Tab,
} from "../types";
import type { CanvasHandlers } from "./MapEditCanvas";
import { RotationControl } from "./MapEditCanvas";

type Props = {
  tab: Tab;
  shops: EditableShop[];
  roads: EditableRoad[];
  landmarks: EditableLandmark[];
  selectedLocationId: string | null;
  selectedRoadId: string | null;
  selectedLandmarkKey: string | null;
  slotAction: SlotAction;
  roadAction: RoadAction;
  draft: { lat: number; lng: number }[];
  search: string;
  zoomIdx: number;
  setZoomIdx: React.Dispatch<React.SetStateAction<number>>;
  focus: { x: number; y: number };
  setFocus: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  rotation: number;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
  projection: Projection;
  handlers: CanvasHandlers;
  isLoading: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

// 旧 MapEditCanvas.tsx の ROAD_COLORS と同じ配色（見た目を揃えるため値をミラーしている）
const ROAD_COLORS: Record<string, { color: string; casing: string }> = {
  market: { color: "#F6E1B4", casing: "#ffffff" },
  street: { color: "#ffffff", casing: "#E4DBC6" },
  path: { color: "#EFE7D6", casing: "#E4DBC6" },
};

const SRC_ROAD_CASING = "nicchyo-edit-road-casing";
const SRC_ROAD_FILL = "nicchyo-edit-road-fill";
const SRC_ROAD_DASH = "nicchyo-edit-road-dash";
const SRC_DRAFT = "nicchyo-edit-draft";
const SRC_SHOPS = "nicchyo-edit-shops";
const SRC_LANDMARKS = "nicchyo-edit-landmarks";

const LAYER_ROAD_CASING = "nicchyo-edit-road-casing-layer";
const LAYER_ROAD_FILL = "nicchyo-edit-road-fill-layer";
const LAYER_ROAD_DASH = "nicchyo-edit-road-dash-layer";
const LAYER_DRAFT = "nicchyo-edit-draft-layer";
const LAYER_SHOP_DOTS = "nicchyo-edit-shop-dots-layer";
const LAYER_SHOP_NUMBERS = "nicchyo-edit-shop-numbers-layer";
const LAYER_LANDMARKS = "nicchyo-edit-landmarks-layer";

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}

function buildBackgroundStyle(): StyleSpecification {
  const tiles = ["a", "b", "c", "d"].map(
    (s) => `https://${s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}.png`
  );
  return {
    version: 8,
    sources: {
      carto: {
        type: "raster",
        tiles,
        tileSize: 256,
        attribution:
          '&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxzoom: 20,
      },
    },
    layers: [
      { id: "background", type: "background", paint: { "background-color": "#FFFAF0" } },
      // 編集画面ではこの背景そのものが位置合わせの基準になるため、公開マップの
      // 薄いオーバーレイ用途とは違い不透明で表示する
      { id: "basemap", type: "raster", source: "carto", paint: { "raster-fade-duration": 0 } },
    ],
  };
}

/** 角度の差を (-180, 180] に正規化する（359度と1度の差を2度として扱うため） */
function bearingDiff(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

function toRing(points: Array<[number, number]>): [number, number][][] {
  return [[...points, points[0]].map(([lat, lng]) => [lng, lat])];
}

function buildRoadFeatureCollections(
  roads: EditableRoad[],
  opts: { selectedRoadId: string | null; tab: Tab; query: string }
): { casing: GeoJSON.FeatureCollection; fill: GeoJSON.FeatureCollection; dash: GeoJSON.FeatureCollection } {
  const casing: GeoJSON.Feature[] = [];
  const fill: GeoJSON.Feature[] = [];
  const dash: GeoJSON.Feature[] = [];

  for (const road of roads) {
    if (road.points.length < 2) continue;
    const centerline = road.points.map((p) => [p.lat, p.lng] as [number, number]);
    const isSelected = opts.tab === "road" && opts.selectedRoadId === road.id;
    const dim = opts.tab === "road" && !!opts.query && !road.name.toLowerCase().includes(opts.query);
    const opacity = dim ? 0.3 : 1;
    const palette = ROAD_COLORS[road.kind] ?? ROAD_COLORS.street;

    const casingRing = buildRoadPolygon(centerline, (road.widthMeters + (isSelected ? 6 : 4)) / 2);
    if (casingRing.length >= 3) {
      casing.push({
        type: "Feature",
        properties: { roadId: road.id, color: isSelected ? "#B45309" : palette.casing, opacity },
        geometry: { type: "Polygon", coordinates: toRing(casingRing) },
      });
    }

    const fillRing = buildRoadPolygon(centerline, road.widthMeters / 2);
    if (fillRing.length >= 3) {
      fill.push({
        type: "Feature",
        properties: { roadId: road.id, color: isSelected ? "#FBCF8A" : palette.color, opacity },
        geometry: { type: "Polygon", coordinates: toRing(fillRing) },
      });
    }

    if (road.kind === "path") {
      dash.push({
        type: "Feature",
        properties: { opacity },
        geometry: { type: "LineString", coordinates: centerline.map(([lat, lng]) => [lng, lat]) },
      });
    }
  }

  return {
    casing: { type: "FeatureCollection", features: casing },
    fill: { type: "FeatureCollection", features: fill },
    dash: { type: "FeatureCollection", features: dash },
  };
}

function buildShopFeatureCollection(
  shops: EditableShop[],
  opts: { selectedLocationId: string | null; slotAction: SlotAction; query: string }
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = shops.map((shop) => {
    const isSelected = opts.selectedLocationId === shop.locationId;
    const match =
      !opts.query || String(shop.position).includes(opts.query) || shop.name.toLowerCase().includes(opts.query);
    const targetable = (opts.slotAction === "move" || opts.slotAction === "place") && !shop.vendorId;
    return {
      type: "Feature",
      properties: {
        locationId: shop.locationId,
        position: shop.position,
        opacity: match ? 1 : 0.15,
        color: shop.vendorId ? (isSelected ? "#B45309" : "#D97706") : targetable ? "#FFF7E6" : "#FFFDF7",
        strokeColor: shop.vendorId ? "#ffffff" : targetable ? "#B45309" : "#B5AA92",
      },
      geometry: { type: "Point", coordinates: [shop.lng, shop.lat] },
    };
  });
  return { type: "FeatureCollection", features };
}

function buildLandmarkFeatureCollection(
  landmarks: EditableLandmark[],
  opts: { tab: Tab; selectedLandmarkKey: string | null; query: string }
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = landmarks.map((landmark) => {
    const isSelected = opts.tab === "landmark" && opts.selectedLandmarkKey === landmark.key;
    const dim = opts.tab === "landmark" && !!opts.query && !landmark.name.toLowerCase().includes(opts.query);
    return {
      type: "Feature",
      properties: {
        key: landmark.key,
        label: `\u{1F3DB}\u{FE0F} ${landmark.name}`,
        opacity: opts.tab === "landmark" ? (dim ? 0.25 : 1) : 0.55,
        selected: isSelected,
      },
      geometry: { type: "Point", coordinates: [landmark.lng, landmark.lat] },
    };
  });
  return { type: "FeatureCollection", features };
}

export default function MapEditCanvasMapLibre({
  tab,
  shops,
  roads,
  landmarks,
  selectedLocationId,
  selectedRoadId,
  selectedLandmarkKey,
  slotAction,
  draft,
  search,
  zoomIdx,
  setZoomIdx,
  focus,
  setFocus,
  rotation,
  setRotation,
  projection,
  handlers,
  isLoading,
  onZoomIn,
  onZoomOut,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // イベントハンドラは map 初期化時に1回だけ登録するため、最新値は ref 経由で読む
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const projectionRef = useRef(projection);
  projectionRef.current = projection;
  const consumedClickRef = useRef(false);

  // ── 地図の初期化（1回だけ。reactStrictMode:false 前提） ──────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialCenter = projectionRef.current.toLatLng(focus);
    const map = new maplibregl.Map({
      container,
      style: buildBackgroundStyle(),
      center: [initialCenter.lng, initialCenter.lat],
      zoom: zoomIdxToMapLibreZoom(zoomIdx),
      bearing: rotationToBearing(rotation),
      pitch: 0,
      attributionControl: { compact: true },
      touchPitch: false,
      pitchWithRotate: false,
      fadeDuration: 0,
    });
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(SRC_ROAD_CASING, { type: "geojson", data: emptyFC() });
      map.addSource(SRC_ROAD_FILL, { type: "geojson", data: emptyFC() });
      map.addSource(SRC_ROAD_DASH, { type: "geojson", data: emptyFC() });
      map.addSource(SRC_DRAFT, { type: "geojson", data: emptyFC() });
      map.addSource(SRC_SHOPS, { type: "geojson", data: emptyFC() });
      map.addSource(SRC_LANDMARKS, { type: "geojson", data: emptyFC() });

      // 道: 当たり判定を広めに取った下地（casing）の上に、実際の道幅の塗り（fill）を重ねる
      map.addLayer({
        id: LAYER_ROAD_CASING,
        type: "fill",
        source: SRC_ROAD_CASING,
        paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] },
      });
      map.addLayer({
        id: LAYER_ROAD_FILL,
        type: "fill",
        source: SRC_ROAD_FILL,
        paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] },
      });
      map.addLayer({
        id: LAYER_ROAD_DASH,
        type: "line",
        source: SRC_ROAD_DASH,
        paint: {
          "line-color": "#c9b98a",
          "line-width": 2,
          "line-dasharray": [2, 2],
          "line-opacity": ["get", "opacity"],
        },
      });
      map.addLayer({
        id: LAYER_DRAFT,
        type: "line",
        source: SRC_DRAFT,
        paint: { "line-color": "#92400E", "line-width": 4, "line-dasharray": [2, 2] },
      });

      map.addLayer({
        id: LAYER_SHOP_DOTS,
        type: "circle",
        source: SRC_SHOPS,
        paint: {
          "circle-radius": [
            "step",
            ["zoom"],
            4,
            MAPLIBRE_ZOOMS[1],
            6,
            MAPLIBRE_ZOOMS[2],
            13,
          ] as unknown as ExpressionSpecification,
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-color": ["get", "strokeColor"],
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: LAYER_SHOP_NUMBERS,
        type: "symbol",
        source: SRC_SHOPS,
        minzoom: MAPLIBRE_ZOOMS[2] - 0.2,
        layout: {
          "text-field": ["get", "position"],
          "text-size": 10,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff", "text-opacity": ["get", "opacity"] },
      });

      map.addLayer({
        id: LAYER_LANDMARKS,
        type: "symbol",
        source: SRC_LANDMARKS,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
          "text-rotation-alignment": "viewport",
        },
        paint: {
          "text-color": "#57503F",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.4,
          "text-opacity": ["get", "opacity"],
        },
      });

      map.on("click", LAYER_ROAD_CASING, (e) => {
        consumedClickRef.current = true;
        if (tabRef.current !== "road") return;
        const roadId = e.features?.[0]?.properties?.roadId;
        if (typeof roadId === "string") handlersRef.current.onSelectRoad(roadId);
      });
      map.on("click", LAYER_SHOP_DOTS, (e) => {
        consumedClickRef.current = true;
        if (tabRef.current !== "slot") return;
        const locationId = e.features?.[0]?.properties?.locationId;
        if (typeof locationId === "string") handlersRef.current.onSelectShop(locationId);
      });
      map.on("click", LAYER_LANDMARKS, (e) => {
        consumedClickRef.current = true;
        if (tabRef.current !== "landmark") return;
        const key = e.features?.[0]?.properties?.key;
        if (typeof key === "string") handlersRef.current.onSelectLandmark(key);
      });
      // 上のレイヤー click で消費されなかったクリックだけ、地図の空き地クリックとして拾う
      // （道の新規描画・建物の新規配置は次のPRでこれを使う）
      map.on("click", (e) => {
        if (consumedClickRef.current) {
          consumedClickRef.current = false;
          return;
        }
        handlersRef.current.onMapClick(e.lngLat.lat, e.lngLat.lng);
      });

      for (const layerId of [LAYER_ROAD_CASING, LAYER_SHOP_DOTS, LAYER_LANDMARKS]) {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      setReady(true);
    });

    // ユーザー操作（ドラッグ・ホイール・ピンチ・回転）の結果を、親の focus/rotation/zoomIdx へ書き戻す。
    // プログラム側の easeTo（下の同期 effect）でも moveend は発火するが、そのときは
    // ほぼ同じ値を書き戻すだけなので実質的な無限ループにはならない
    map.on("moveend", () => {
      const center = map.getCenter();
      setFocus(projectionRef.current.toLocal(center.lat, center.lng));
      setRotation(bearingToRotation(map.getBearing()));
      setZoomIdx(nearestZoomIdx(map.getZoom()));
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // 初期化は1回だけ。以降の focus/zoomIdx/rotation の変更は下の同期 effect で反映する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── カメラの同期（props → map）。差が小さいときは easeTo を呼ばない ──────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const targetZoom = zoomIdxToMapLibreZoom(zoomIdx);
    if (Math.abs(map.getZoom() - targetZoom) > 0.05) {
      map.easeTo({ zoom: targetZoom, duration: 200 });
    }
  }, [zoomIdx, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const targetBearing = rotationToBearing(rotation);
    if (Math.abs(bearingDiff(map.getBearing(), targetBearing)) > 0.5) {
      map.easeTo({ bearing: targetBearing, duration: 200 });
    }
  }, [rotation, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const target = projection.toLatLng(focus);
    const current = map.getCenter();
    if (Math.hypot(current.lat - target.lat, current.lng - target.lng) > 1e-7) {
      map.easeTo({ center: [target.lng, target.lat], duration: 200 });
    }
  }, [focus, projection, ready]);

  // ── データの反映（全置換 setData。公開マップと同じパターン） ──────────
  const query = search.trim().toLowerCase();

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const { casing, fill, dash } = buildRoadFeatureCollections(roads, { selectedRoadId, tab, query });
    (map.getSource(SRC_ROAD_CASING) as maplibregl.GeoJSONSource).setData(casing);
    (map.getSource(SRC_ROAD_FILL) as maplibregl.GeoJSONSource).setData(fill);
    (map.getSource(SRC_ROAD_DASH) as maplibregl.GeoJSONSource).setData(dash);
  }, [roads, selectedRoadId, tab, query, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = buildShopFeatureCollection(shops, { selectedLocationId, slotAction, query });
    (map.getSource(SRC_SHOPS) as maplibregl.GeoJSONSource).setData(data);
    map.setLayoutProperty(LAYER_SHOP_DOTS, "visibility", tab === "slot" ? "visible" : "none");
    map.setLayoutProperty(LAYER_SHOP_NUMBERS, "visibility", tab === "slot" ? "visible" : "none");
  }, [shops, selectedLocationId, slotAction, query, tab, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = buildLandmarkFeatureCollection(landmarks, { tab, selectedLandmarkKey, query });
    (map.getSource(SRC_LANDMARKS) as maplibregl.GeoJSONSource).setData(data);
  }, [landmarks, tab, selectedLandmarkKey, query, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data: GeoJSON.FeatureCollection =
      draft.length >= 2
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: draft.map((p) => [p.lng, p.lat]) },
              },
            ],
          }
        : emptyFC();
    (map.getSource(SRC_DRAFT) as maplibregl.GeoJSONSource).setData(data);
  }, [draft, ready]);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
        background: "#E9E3D5",
      }}
    >
      {/* maplibre-gl.css が .maplibregl-map に position:relative を当てるので、サイズはインラインで明示する */}
      <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />

      {isLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9A8A6A",
            fontSize: 13,
            pointerEvents: "none",
          }}
        >
          読み込み中...
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          pointerEvents: "none",
          borderRadius: 999,
          background: "rgba(255,255,255,.85)",
          padding: "4px 10px",
          fontSize: 11,
          fontWeight: 700,
          color: "#57503F",
        }}
      >
        MapLibre 版（検証中）
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: 11,
          boxShadow: "0 2px 8px rgba(15,23,42,.18)",
          overflow: "hidden",
        }}
      >
        <span
          onClick={onZoomIn}
          style={{ padding: "9px 13px", fontSize: 16, fontWeight: 700, cursor: "pointer", color: "#92400E", textAlign: "center" }}
        >
          ＋
        </span>
        <span
          onClick={onZoomOut}
          style={{ padding: "9px 13px", fontSize: 16, fontWeight: 700, cursor: "pointer", color: "#92400E", textAlign: "center" }}
        >
          －
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#fff",
          borderRadius: 14,
          boxShadow: "0 2px 8px rgba(15,23,42,.18)",
          padding: "8px 8px 10px",
        }}
      >
        <RotationControl rotation={rotation} setRotation={setRotation} />
      </div>
    </div>
  );
}
