"use client";

/**
 * 管理画面マップ編集のキャンバス（Issue #650）。
 *
 * 旧実装（Leaflet背景＋自前SVGキャンバス。`MapEditCanvas.tsx`/`LeafletBackground.tsx`）を
 * 置き換え、公開マップと同じ MapLibre 上に描き直したもの。背景・区画・道・建物が
 * 同じ地図の上に乗るため、投影方式の違いによる位置ずれ（#490）が構造上なくなる。
 *
 * PR①（表示・選択・カメラ操作）・PR②（編集操作: 道の頂点ドラッグ・ダブルクリック削除・
 * 中点クリックで挿入、建物のドラッグ移動・クリックでの新規配置）に続き、この PR③で
 * 旧実装を削除しこのコンポーネントだけにした。道の頂点・建物は GeoJSON レイヤーではなく
 * `maplibregl.Marker`（ドラッグ可能なDOM要素）で表現している。GeoJSON の
 * `setData` 全置換だと、ドラッグ中に親の state が更新されるたびに要素そのものが
 * 作り直され、ブラウザ標準のドラッグ操作が壊れてしまうため。
 *
 * MapEditClientV3 が持つカメラ状態（focus/zoomIdx/rotation）は変えず、MapLibreの
 * center/zoom/bearingとの相互変換は mapEditCamera.ts に閉じ込めている。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@/lib/map/maplibreWorker";
import { OPENFREEMAP_STYLE_URL } from "../../../map/config/basemap";
import { buildRoadPolygon } from "../../../map/utils/mapRouteGeometry";
import type { Projection } from "../geo";
import {
  MAPLIBRE_ZOOMS,
  bearingToRotation,
  nearestZoomIdx,
  rotationToBearing,
  zoomIdxToMapLibreZoom,
} from "../mapEditCamera";
import { EDITOR_COLORS } from "../editorTheme";
import type { CanvasHandlers, EditableLandmark, EditableRoad, EditableShop, Selection, Tool } from "../types";

type Props = {
  tool: Tool;
  selection: Selection | null;
  /** 保存していない変更がある要素（"shops:<locationId>" / "roads:<id>" / "landmarks:<key>"） */
  unsavedKeys: ReadonlySet<string>;
  shops: EditableShop[];
  roads: EditableRoad[];
  landmarks: EditableLandmark[];
  draft: { lat: number; lng: number }[];
  /** 区画分けツールのプレビュー（適用前の、新しく作る・動く・消す区画の位置） */
  previewSlots: Array<{ lat: number; lng: number; status: "create" | "move" | "delete" }>;
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
const SRC_ROAD_UNSAVED = "nicchyo-edit-road-unsaved";
const SRC_DRAFT = "nicchyo-edit-draft";
const SRC_DRAFT_CURSOR = "nicchyo-edit-draft-cursor";
const SRC_SHOPS = "nicchyo-edit-shops";
const SRC_SLOT_PREVIEW = "nicchyo-edit-slot-preview";
const SRC_VENDOR_DRAG = "nicchyo-edit-vendor-drag";

const LAYER_ROAD_CASING = "nicchyo-edit-road-casing-layer";
const LAYER_ROAD_FILL = "nicchyo-edit-road-fill-layer";
const LAYER_ROAD_DASH = "nicchyo-edit-road-dash-layer";
const LAYER_ROAD_UNSAVED = "nicchyo-edit-road-unsaved-layer";
const LAYER_DRAFT = "nicchyo-edit-draft-layer";
const LAYER_DRAFT_POINTS = "nicchyo-edit-draft-points-layer";
const LAYER_DRAFT_CURSOR = "nicchyo-edit-draft-cursor-layer";
const LAYER_SHOP_DOTS = "nicchyo-edit-shop-dots-layer";
const LAYER_SHOP_NUMBERS = "nicchyo-edit-shop-numbers-layer";
const LAYER_SLOT_PREVIEW = "nicchyo-edit-slot-preview-layer";
const LAYER_VENDOR_DRAG = "nicchyo-edit-vendor-drag-layer";
/** ピンを掴んだ・離した地点から、区画を探す範囲（px）。点が小さいので少し広めに取る */
const SLOT_HIT_RADIUS_PX = 8;

function emptyFC(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
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
  opts: { selectedRoadId: string | null; query: string; unsavedKeys: ReadonlySet<string> }
): {
  casing: GeoJSON.FeatureCollection;
  fill: GeoJSON.FeatureCollection;
  dash: GeoJSON.FeatureCollection;
  unsaved: GeoJSON.FeatureCollection;
} {
  const casing: GeoJSON.Feature[] = [];
  const fill: GeoJSON.Feature[] = [];
  const dash: GeoJSON.Feature[] = [];
  const unsaved: GeoJSON.Feature[] = [];

  for (const road of roads) {
    if (road.points.length < 2) continue;
    const centerline = road.points.map((p) => [p.lat, p.lng] as [number, number]);
    const isSelected = opts.selectedRoadId === road.id;
    const dim = !!opts.query && !road.name.toLowerCase().includes(opts.query);
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

    if (opts.unsavedKeys.has(`roads:${road.id}`)) {
      unsaved.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: centerline.map(([lat, lng]) => [lng, lat]) },
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
    unsaved: { type: "FeatureCollection", features: unsaved },
  };
}

function buildShopFeatureCollection(
  shops: EditableShop[],
  opts: {
    selectedLocationId: string | null;
    query: string;
    unsavedKeys: ReadonlySet<string>;
  }
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = shops.map((shop) => {
    const isSelected = opts.selectedLocationId === shop.locationId;
    const match =
      !opts.query || String(shop.position).includes(opts.query) || shop.name.toLowerCase().includes(opts.query);
    const unsaved = opts.unsavedKeys.has(`shops:${shop.locationId}`);
    return {
      type: "Feature",
      properties: {
        locationId: shop.locationId,
        position: shop.position,
        opacity: match ? 1 : 0.15,
        hasVendor: !!shop.vendorId,
        // 出店者のいる区画はオレンジのピン、空き区画はグレーで、ひと目で空きと分かるようにする
        color: shop.vendorId
          ? isSelected
            ? EDITOR_COLORS.selectedSlot
            : EDITOR_COLORS.occupiedSlot
          : EDITOR_COLORS.vacantSlot,
        strokeColor: unsaved
          ? EDITOR_COLORS.unsaved
          : shop.vendorId
            ? EDITOR_COLORS.surface
            : EDITOR_COLORS.vacantSlotStroke,
        // 出店者ありの区画は color 側で選択を表すが、空き区画は常に同じ色のため
        // 選択しても見分けられない。circle-radius/circle-stroke-width 側で使う
        selected: isSelected,
      },
      geometry: { type: "Point", coordinates: [shop.lng, shop.lat] },
    };
  });
  return { type: "FeatureCollection", features };
}

/** 建物ラベル（Marker）の見た目を、旧 MapEditCanvas.tsx の建物マーカーに合わせて更新する */
function styleLandmarkElement(
  el: HTMLDivElement,
  landmark: EditableLandmark,
  opts: { isSelected: boolean; opacity: number; draggable: boolean; unsaved: boolean }
) {
  el.textContent = `\u{1F3DB}\u{FE0F} ${landmark.name}`;
  Object.assign(el.style, {
    padding: "3px 8px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: "800",
    whiteSpace: "nowrap",
    background: opts.isSelected ? "#92400E" : "#ffffffee",
    color: opts.isSelected ? "#fff" : "#57503F",
    border: opts.unsaved ? `2px solid ${EDITOR_COLORS.unsaved}` : "1px solid #E0B877",
    boxShadow: "0 1px 4px rgba(0,0,0,.2)",
    opacity: String(opts.opacity),
    cursor: opts.draggable ? "grab" : "default",
    // 選択ツール以外（道を描く・建物を置く等）では、地図へのクリックを奪わない
    pointerEvents: opts.draggable ? "auto" : "none",
  } satisfies Partial<CSSStyleDeclaration>);
}

/** 道の頂点ハンドル（Marker）の見た目。旧 MapEditCanvas.tsx の頂点ハンドルと同じ */
function createVertexElement(): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "18px",
    height: "18px",
    borderRadius: "5px",
    background: "#fff",
    border: "3px solid #B45309",
    boxShadow: "0 2px 6px rgba(0,0,0,.3)",
    cursor: "grab",
  } satisfies Partial<CSSStyleDeclaration>);
  return el;
}

/** 中点ハンドル（Marker）の見た目。旧 MapEditCanvas.tsx の中点ハンドルと同じ */
function createMidpointElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = "＋";
  Object.assign(el.style, {
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    background: "#FFF7E6",
    border: "2px dashed #B45309",
    color: "#92400E",
    fontSize: "10px",
    fontWeight: "900",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "copy",
  } satisfies Partial<CSSStyleDeclaration>);
  return el;
}

// 左右それぞれ10度・30度分「加算」するボタン（タップした分だけ回転が積み重なる）
const ROTATION_STEPS = [-30, -10, 10, 30];

/** 回転角を (-180, 180] の範囲に正規化する（何度も回転を加算しても値が際限なく増えないように） */
function normalizeRotationDeg(deg: number): number {
  let normalized = deg % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return normalized;
}

/**
 * マップの回転コントロール。左右のボタンはタップするたびにその角度分だけ
 * 現在の回転角に「加算」していく（例: 右10を2回で右へ20度）。中央のボタンは
 * 初期角度（0度）に戻すリセット専用。ボタン同士が重ならないよう、円弧状には
 * 並べず横一列に並べ、それぞれに文字ラベルを付けて何のボタンか分かるようにする。
 *
 * 旧 MapEditCanvas.tsx から移設（振る舞いの変更なし）。
 */
function RotationControl({
  rotation,
  setRotation,
}: {
  rotation: number;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
}) {
  const displayDeg = Math.round(normalizeRotationDeg(rotation));
  const isAtInitial = displayDeg === 0;

  const stepButtonStyle: React.CSSProperties = {
    padding: "6px 9px",
    borderRadius: 8,
    fontSize: 11.5,
    fontWeight: 800,
    cursor: "pointer",
    border: "1px solid #E4D9BF",
    background: "#FDFBF5",
    color: "#57503F",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {ROTATION_STEPS.filter((deg) => deg < 0).map((deg) => (
          <button
            key={deg}
            type="button"
            onClick={() => setRotation((prev) => normalizeRotationDeg(prev + deg))}
            title={`左へ${Math.abs(deg)}度回転（タップするたびに加算）`}
            style={stepButtonStyle}
          >
            {deg}°
          </button>
        ))}
        <button
          type="button"
          onClick={() => setRotation(0)}
          title="初期角度（0度）に戻す"
          style={{
            ...stepButtonStyle,
            padding: "6px 11px",
            border: isAtInitial ? "2px solid #92400E" : "1px solid #E4D9BF",
            background: isAtInitial ? "#92400E" : "#fff",
            color: isAtInitial ? "#fff" : "#57503F",
          }}
        >
          ⟲ リセット
        </button>
        {ROTATION_STEPS.filter((deg) => deg > 0).map((deg) => (
          <button
            key={deg}
            type="button"
            onClick={() => setRotation((prev) => normalizeRotationDeg(prev + deg))}
            title={`右へ${deg}度回転（タップするたびに加算）`}
            style={stepButtonStyle}
          >
            +{deg}°
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9A8A6A" }}>現在の向き: {displayDeg}°</div>
    </div>
  );
}

export default function MapEditCanvasMapLibre({
  tool,
  selection,
  unsavedKeys,
  shops,
  roads,
  landmarks,
  draft,
  previewSlots,
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

  const selectedLocationId = selection?.kind === "slot" ? selection.id : null;
  const selectedRoadId = selection?.kind === "road" ? selection.id : null;
  const selectedLandmarkKey = selection?.kind === "landmark" ? selection.id : null;

  // イベントハンドラは map 初期化時に1回だけ登録するため、最新値は ref 経由で読む
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const projectionRef = useRef(projection);
  projectionRef.current = projection;
  // ユーザー操作由来の moveend で focus/rotation/zoomIdx を書き戻した直後、
  // 続けて走る同期 effect の easeTo を1回だけスキップするための印
  const suppressNextSyncRef = useRef(false);
  // 同期 effect の easeTo 呼び出し中かどうか。easeTo は進行中のアニメーション（慣性・
  // キーボード移動など。これらも originalEvent 付き）を同期的に止めて moveend を出すため、
  // その途中値をユーザー操作として書き戻さないための印
  const syncingCameraRef = useRef(false);
  // 頂点の右クリックメニュー（地図の枠の中での位置と、対象の頂点）
  const [vertexMenu, setVertexMenu] = useState<{ x: number; y: number; roadId: string; pointId: string } | null>(null);
  const closeVertexMenu = useCallback(() => setVertexMenu(null), []);
  // 描いている道の点。mousemove（初期化時に1回だけ登録）から最新の値を読むため ref にも持つ
  const draftRef = useRef(draft);
  draftRef.current = draft;
  // 出店者のピンをドラッグしている最中の状態（移動元の区画・今重なっている移動先・動いたか）
  const vendorDragRef = useRef<{ fromId: string; targetId: string | null; moved: boolean } | null>(null);
  // 道・区画レイヤーで選択が起きたクリックかどうか。立っている間は、地図全体の
  // click（空き地クリック＝新規描画の点追加・新規配置用）に流さない
  const consumedClickRef = useRef(false);

  // 建物・道の頂点/中点は GeoJSON ではなく maplibregl.Marker（ドラッグ可能なDOM要素）で持つ。
  // id をキーに使い回し、setLngLat で位置だけ更新する（作り直すとドラッグ中の操作が壊れるため）
  const landmarkMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const vertexMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const midpointMarkersRef = useRef<maplibregl.Marker[]>([]);

  // ── 地図の初期化（1回だけ。reactStrictMode:false 前提） ──────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const initialCenter = projectionRef.current.toLatLng(focus);
    const map = new maplibregl.Map({
      container,
      // CARTO のラスタータイルは無料枠のレート制限で「API KEY REQUIRED」の
      // 透かしが出ることがあるため、公開マップの vector-openfreemap モードと
      // 同じ OpenFreeMap のベクタータイル（キー不要・レート制限なし）を使う
      style: OPENFREEMAP_STYLE_URL,
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
      map.addSource(SRC_ROAD_UNSAVED, { type: "geojson", data: emptyFC() });
      map.addSource(SRC_DRAFT, { type: "geojson", data: emptyFC() });
      map.addSource(SRC_DRAFT_CURSOR, { type: "geojson", data: emptyFC() });
      // promoteId: ドラッグ中の移動先の強調に feature-state（区画ごとの状態）を使うため
      map.addSource(SRC_SHOPS, { type: "geojson", data: emptyFC(), promoteId: "locationId" });
      map.addSource(SRC_VENDOR_DRAG, { type: "geojson", data: emptyFC() });
      map.addSource(SRC_SLOT_PREVIEW, { type: "geojson", data: emptyFC() });

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
      // 保存していない変更がある道は、中心線を点線でなぞって印にする
      map.addLayer({
        id: LAYER_ROAD_UNSAVED,
        type: "line",
        source: SRC_ROAD_UNSAVED,
        paint: { "line-color": EDITOR_COLORS.unsaved, "line-width": 3, "line-dasharray": [1.5, 1.5] },
      });
      map.addLayer({
        id: LAYER_DRAFT,
        type: "line",
        source: SRC_DRAFT,
        filter: ["==", ["geometry-type"], "LineString"],
        paint: { "line-color": EDITOR_COLORS.accent, "line-width": 4, "line-dasharray": [2, 2] },
      });
      // 描いている道の、最後の点からカーソルまでの線（次にクリックする位置の目安）
      map.addLayer({
        id: LAYER_DRAFT_CURSOR,
        type: "line",
        source: SRC_DRAFT_CURSOR,
        paint: { "line-color": EDITOR_COLORS.accent, "line-width": 2, "line-opacity": 0.6, "line-dasharray": [1, 1.5] },
      });
      map.addLayer({
        id: LAYER_DRAFT_POINTS,
        type: "circle",
        source: SRC_DRAFT,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": EDITOR_COLORS.surface,
          "circle-stroke-width": 3,
          "circle-stroke-color": EDITOR_COLORS.accent,
        },
      });

      map.addLayer({
        id: LAYER_SHOP_DOTS,
        type: "circle",
        source: SRC_SHOPS,
        paint: {
          // 出店者ありの区画は color 側の変化（buildShopFeatureCollection）で選択を表すが、
          // 空き区画は常に同じ色のため、選択しても見分けられない。旧キャンバスの
          // 「選ぶと大きくなり、周りに影が付く」見た目を、大きさとストローク（縁）で近似する。
          //
          // zoom ベースの step/interpolate は式全体で1回までしか使えない
          // （MapLibre のスタイル検証エラー: "Only one zoom-based step or interpolate
          // subexpression may be used"）。case の各分岐に別々の zoom step を持たせるのではなく、
          // 外側を1本の zoom step にし、各段の値を case で選ぶ形に入れ替える
          "circle-radius": [
            "step",
            ["zoom"],
            ["case", ["get", "selected"], 8, 4],
            MAPLIBRE_ZOOMS[1],
            ["case", ["get", "selected"], 10, 6],
            MAPLIBRE_ZOOMS[2],
            ["case", ["get", "selected"], 17, 13],
          ] as unknown as ExpressionSpecification,
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-color": [
            "case",
            ["boolean", ["feature-state", "dropTarget"], false],
            EDITOR_COLORS.accent,
            ["get", "selected"],
            "rgba(180,83,9,0.55)",
            ["get", "strokeColor"],
          ] as unknown as ExpressionSpecification,
          "circle-stroke-width": [
            "case",
            ["boolean", ["feature-state", "dropTarget"], false],
            6,
            ["get", "selected"],
            5,
            2,
          ] as unknown as ExpressionSpecification,
        },
      });
      map.addLayer({
        id: LAYER_SHOP_NUMBERS,
        type: "symbol",
        source: SRC_SHOPS,
        minzoom: MAPLIBRE_ZOOMS[2] - 0.2,
        layout: {
          "text-field": ["get", "position"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 10,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: { "text-color": "#ffffff", "text-opacity": ["get", "opacity"] },
      });

      // ドラッグ中のピン（カーソルについてくる）
      map.addLayer({
        id: LAYER_VENDOR_DRAG,
        type: "circle",
        source: SRC_VENDOR_DRAG,
        paint: {
          "circle-radius": 11,
          "circle-color": EDITOR_COLORS.occupiedSlot,
          "circle-opacity": 0.75,
          "circle-stroke-width": 2,
          "circle-stroke-color": EDITOR_COLORS.surface,
        },
      });

      // ── 出店者のピンのドラッグ（別の区画へ移す・入れ替える） ──
      // 出店者のいる区画の点を掴んだら地図のパンを止め、離した地点の区画へ移す。
      // マウスとタッチの両方で同じ流れにする
      const slotAt = (point: maplibregl.PointLike): string | null => {
        const p = maplibregl.Point.convert(point);
        const features = map.queryRenderedFeatures(
          [
            [p.x - SLOT_HIT_RADIUS_PX, p.y - SLOT_HIT_RADIUS_PX],
            [p.x + SLOT_HIT_RADIUS_PX, p.y + SLOT_HIT_RADIUS_PX],
          ],
          { layers: [LAYER_SHOP_DOTS] }
        );
        const id = features[0]?.properties?.locationId;
        return typeof id === "string" ? id : null;
      };
      const setDropTarget = (id: string | null) => {
        const drag = vendorDragRef.current;
        if (!drag || drag.targetId === id) return;
        if (drag.targetId) map.setFeatureState({ source: SRC_SHOPS, id: drag.targetId }, { dropTarget: false });
        if (id) map.setFeatureState({ source: SRC_SHOPS, id }, { dropTarget: true });
        drag.targetId = id;
      };
      const startVendorDrag = (e: maplibregl.MapLayerMouseEvent | maplibregl.MapLayerTouchEvent) => {
        if (toolRef.current !== "select") return;
        if ("points" in e && e.points.length !== 1) return;
        const feature = e.features?.[0];
        const locationId = feature?.properties?.locationId;
        if (!feature?.properties?.hasVendor || typeof locationId !== "string") return;
        e.preventDefault(); // 地図のパンを止める
        vendorDragRef.current = { fromId: locationId, targetId: null, moved: false };
        map.getCanvas().style.cursor = "grabbing";
      };
      const moveVendorDrag = (e: maplibregl.MapMouseEvent | maplibregl.MapTouchEvent) => {
        const drag = vendorDragRef.current;
        if (!drag) return;
        drag.moved = true;
        (map.getSource(SRC_VENDOR_DRAG) as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection",
          features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [e.lngLat.lng, e.lngLat.lat] } }],
        });
        const target = slotAt(e.point);
        setDropTarget(target && target !== drag.fromId ? target : null);
      };
      const endVendorDrag = () => {
        const drag = vendorDragRef.current;
        if (!drag) return;
        const { fromId, targetId, moved } = drag;
        setDropTarget(null);
        vendorDragRef.current = null;
        (map.getSource(SRC_VENDOR_DRAG) as maplibregl.GeoJSONSource).setData(emptyFC());
        map.getCanvas().style.cursor = "";
        // 動かしたときは地図の click は起きない（MapLibre はクリックとみなす移動量を超えた
        // マウス操作で click を出さない）ので、ここで消費済みの印を立てる必要はない
        if (moved && targetId) handlersRef.current.onDropVendor(fromId, targetId);
      };
      map.on("mousedown", LAYER_SHOP_DOTS, startVendorDrag);
      map.on("touchstart", LAYER_SHOP_DOTS, startVendorDrag);
      map.on("mousemove", moveVendorDrag);
      map.on("touchmove", moveVendorDrag);
      map.on("mouseup", endVendorDrag);
      map.on("touchend", endVendorDrag);

      // 区画分けのプレビュー。区画の上に重ね、作る・動く・消すを色で分ける
      map.addLayer({
        id: LAYER_SLOT_PREVIEW,
        type: "circle",
        source: SRC_SLOT_PREVIEW,
        paint: {
          "circle-radius": ["step", ["zoom"], 5, MAPLIBRE_ZOOMS[1], 7, MAPLIBRE_ZOOMS[2], 14] as unknown as ExpressionSpecification,
          "circle-color": [
            "match",
            ["get", "status"],
            "create",
            EDITOR_COLORS.previewCreate,
            "move",
            EDITOR_COLORS.previewMove,
            "rgba(0,0,0,0)",
          ] as unknown as ExpressionSpecification,
          "circle-opacity": 0.85,
          "circle-stroke-width": 2.5,
          "circle-stroke-color": [
            "match",
            ["get", "status"],
            "delete",
            EDITOR_COLORS.previewDelete,
            EDITOR_COLORS.surface,
          ] as unknown as ExpressionSpecification,
        },
      });

      // 道具が実際にこのレイヤーで選択したときだけ消費したことにする（一律で立てると、
      // 道を描く道具で道の上をクリックして点を打つ、といった操作が下の「空き地クリック」に
      // 届かなくなる）。区画は道の上に重なっているため、区画のクリックを道より優先する
      map.on("click", LAYER_SHOP_DOTS, (e) => {
        if (toolRef.current !== "select") return;
        consumedClickRef.current = true;
        const locationId = e.features?.[0]?.properties?.locationId;
        if (typeof locationId === "string") handlersRef.current.onSelectShop(locationId);
      });
      map.on("click", LAYER_ROAD_CASING, (e) => {
        // 道を描く道具・建物を置く道具では、空き地クリック（onMapClick）へ流す
        if (toolRef.current !== "select" && toolRef.current !== "splitSlots") return;
        if (consumedClickRef.current) return;
        consumedClickRef.current = true;
        const roadId = e.features?.[0]?.properties?.roadId;
        if (typeof roadId === "string") handlersRef.current.onSelectRoad(roadId);
      });
      // 建物（landmark）はGeoJSONレイヤーではなくドラッグ可能なDOM要素（Marker）で
      // 表現しているため、選択クリックはマーカー自身のイベントで処理する（下の方の
      // landmarkMarkersRef 周りを参照）。ここでは道・区画レイヤー以外の
      // クリックだけを、地図の空き地クリックとして拾う（道の新規描画時の点追加・
      // 建物の新規配置に使う。マーカー自体は map のキャンバスと別のDOM要素なので、
      // マーカー上のクリックはそもそもここに来ない）
      map.on("click", (e) => {
        if (consumedClickRef.current) {
          consumedClickRef.current = false;
          return;
        }
        handlersRef.current.onMapClick(e.lngLat.lat, e.lngLat.lng);
      });
      map.on("dblclick", (e) => {
        // 道を描く道具では、ダブルクリックは地図の拡大ではなく道の確定に使う
        if (toolRef.current !== "drawRoad") return;
        e.preventDefault();
        handlersRef.current.onMapDoubleClick(e.lngLat.lat, e.lngLat.lng);
      });
      map.on("mousemove", (e) => {
        const last = draftRef.current[draftRef.current.length - 1];
        const source = map.getSource(SRC_DRAFT_CURSOR) as maplibregl.GeoJSONSource | undefined;
        if (!source) return;
        source.setData(
          toolRef.current === "drawRoad" && last
            ? {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    properties: {},
                    geometry: { type: "LineString", coordinates: [[last.lng, last.lat], [e.lngLat.lng, e.lngLat.lat]] },
                  },
                ],
              }
            : emptyFC()
        );
      });
      // 地図を動かしたら頂点の右クリックメニューは閉じる
      map.on("movestart", () => setVertexMenu(null));

      for (const layerId of [LAYER_ROAD_CASING, LAYER_SHOP_DOTS]) {
        map.on("mouseenter", layerId, () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", layerId, () => {
          map.getCanvas().style.cursor = "";
        });
      }

      setReady(true);
    });

    // ユーザー操作（ドラッグ・ホイール・ピンチ・回転）の結果を、親の focus/rotation/zoomIdx へ
    // 書き戻す。e.originalEvent はユーザーの入力デバイスイベントが原因のときだけ入っており、
    // 下の同期 effect の easeTo が別のアニメーションを止めたときの moveend では入らない。
    // そこだけ見て弾かないと、「途中で止まった側の中途半端な値」を書き戻してしまい、
    // 連打したズームボタンが1段しか進まない、といった事故になる。
    //
    // 書き戻した直後は、この値を使って下の同期 effect も走る。しかし地図は既に
    // ユーザー操作でその位置にいる（zoomIdx は連続値を段階へ丸めただけで、実際の
    // ズームとは値がずれている）ため、そのまま easeTo を呼ぶと、地図がユーザーの
    // 操作を追い越して段階の位置へ「吸い付く」ように動いてしまう。suppressNextSyncRef を
    // 立てて、この1回だけ同期 effect の easeTo をスキップさせる
    map.on("moveend", (e) => {
      if (!e.originalEvent || syncingCameraRef.current) return;
      suppressNextSyncRef.current = true;
      const center = map.getCenter();
      setFocus(projectionRef.current.toLocal(center.lat, center.lng));
      setRotation(bearingToRotation(map.getBearing()));
      setZoomIdx(nearestZoomIdx(map.getZoom()));
    });

    const landmarkMarkers = landmarkMarkersRef.current;
    const vertexMarkers = vertexMarkersRef.current;
    return () => {
      landmarkMarkers.forEach((m) => m.remove());
      landmarkMarkers.clear();
      vertexMarkers.forEach((m) => m.remove());
      vertexMarkers.clear();
      midpointMarkersRef.current.forEach((m) => m.remove());
      midpointMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
    // 初期化は1回だけ。以降の focus/zoomIdx/rotation の変更は下の同期 effect で反映する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── カメラの同期（props → map）。────────────────────────────────
  // zoom/bearing/center を3つの別々の effect で easeTo すると、それぞれが呼ぶ easeTo が
  // 互いのアニメーションを止め合い、moveend が「途中で止まった値」を拾ってしまう
  // （連打したズームボタンが1段しか進まない不具合の原因だった）。1つの effect にまとめ、
  // 変わったものだけをまとめて1回の easeTo で渡す
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (suppressNextSyncRef.current) {
      suppressNextSyncRef.current = false;
      return;
    }

    const targetZoom = zoomIdxToMapLibreZoom(zoomIdx);
    const targetBearing = rotationToBearing(rotation);
    const targetCenter = projection.toLatLng(focus);
    const currentCenter = map.getCenter();

    const zoomChanged = Math.abs(map.getZoom() - targetZoom) > 0.05;
    const bearingChanged = Math.abs(bearingDiff(map.getBearing(), targetBearing)) > 0.5;
    const centerChanged =
      Math.hypot(currentCenter.lat - targetCenter.lat, currentCenter.lng - targetCenter.lng) > 1e-7;
    if (!zoomChanged && !bearingChanged && !centerChanged) return;

    syncingCameraRef.current = true;
    try {
      map.easeTo({
        zoom: targetZoom,
        bearing: targetBearing,
        center: [targetCenter.lng, targetCenter.lat],
        duration: 200,
      });
    } finally {
      syncingCameraRef.current = false;
    }
  }, [zoomIdx, rotation, focus, projection, ready]);

  // ── データの反映（全置換 setData。公開マップと同じパターン） ──────────
  const query = search.trim().toLowerCase();

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const { casing, fill, dash, unsaved } = buildRoadFeatureCollections(roads, { selectedRoadId, query, unsavedKeys });
    (map.getSource(SRC_ROAD_CASING) as maplibregl.GeoJSONSource).setData(casing);
    (map.getSource(SRC_ROAD_FILL) as maplibregl.GeoJSONSource).setData(fill);
    (map.getSource(SRC_ROAD_DASH) as maplibregl.GeoJSONSource).setData(dash);
    (map.getSource(SRC_ROAD_UNSAVED) as maplibregl.GeoJSONSource).setData(unsaved);
  }, [roads, selectedRoadId, query, unsavedKeys, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const data = buildShopFeatureCollection(shops, { selectedLocationId, query, unsavedKeys });
    (map.getSource(SRC_SHOPS) as maplibregl.GeoJSONSource).setData(data);
  }, [shops, selectedLocationId, query, unsavedKeys, ready]);

  // ── 建物（Marker）。ドラッグ中も要素を作り直さないよう、key で使い回す ──────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const existing = landmarkMarkersRef.current;
    const seen = new Set<string>();

    for (const landmark of landmarks) {
      seen.add(landmark.key);
      const isSelected = selectedLandmarkKey === landmark.key;
      const dim = !!query && !landmark.name.toLowerCase().includes(query);
      const opacity = dim ? 0.25 : 1;
      // 選択ツールのときだけ掴める。他の道具のときは地図へのクリックを奪わない
      const draggable = tool === "select";
      const unsaved = unsavedKeys.has(`landmarks:${landmark.key}`);

      let marker = existing.get(landmark.key);
      if (!marker) {
        const el = document.createElement("div");
        el.addEventListener("click", (event) => {
          if (toolRef.current !== "select") return;
          event.stopPropagation();
          handlersRef.current.onSelectLandmark(landmark.key);
        });
        marker = new maplibregl.Marker({ element: el, draggable, anchor: "center" });
        marker.on("drag", () => {
          const lngLat = marker!.getLngLat();
          handlersRef.current.onMoveLandmark(landmark.key, lngLat.lat, lngLat.lng);
        });
        marker.on("dragend", () => {
          const lngLat = marker!.getLngLat();
          handlersRef.current.onMoveLandmarkEnd(landmark.key, lngLat.lat, lngLat.lng);
        });
        marker.setLngLat([landmark.lng, landmark.lat]);
        marker.addTo(map);
        existing.set(landmark.key, marker);
      } else {
        // ドラッグ中の自分自身の更新も通るが、ほぼ同じ座標へのno-opになるだけで実害はない
        marker.setLngLat([landmark.lng, landmark.lat]);
      }
      marker.setDraggable(draggable);
      styleLandmarkElement(marker.getElement() as HTMLDivElement, landmark, { isSelected, opacity, draggable, unsaved });
    }

    for (const [key, marker] of existing) {
      if (!seen.has(key)) {
        marker.remove();
        existing.delete(key);
      }
    }
  }, [landmarks, tool, selectedLandmarkKey, query, unsavedKeys, ready]);

  // ── 道の頂点・中点（Marker）。選択ツールで道を選んでいるときだけ出す ──────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vertexExisting = vertexMarkersRef.current;
    const midpointExisting = midpointMarkersRef.current;
    const road = tool === "select" ? roads.find((r) => r.id === selectedRoadId) ?? null : null;

    if (!road) {
      vertexExisting.forEach((m) => m.remove());
      vertexExisting.clear();
      midpointExisting.forEach((m) => m.remove());
      midpointMarkersRef.current = [];
      return;
    }

    const seen = new Set<string>();
    for (const point of road.points) {
      seen.add(point.id);
      let marker = vertexExisting.get(point.id);
      if (!marker) {
        const el = createVertexElement();
        // 頂点のクリックが下の道レイヤーの click に伝わり、選択が別の道へ飛ぶのを防ぐ
        el.addEventListener("click", (event) => event.stopPropagation());
        el.addEventListener("dblclick", (event) => {
          event.stopPropagation();
          handlersRef.current.onVertexRemove(road.id, point.id);
        });
        // 右クリックで「この点を削除」のメニューを出す（ダブルクリックでの削除に気づけない人向け）
        el.addEventListener("contextmenu", (event) => {
          event.preventDefault();
          event.stopPropagation();
          const rect = containerRef.current?.getBoundingClientRect();
          setVertexMenu({
            x: event.clientX - (rect?.left ?? 0),
            y: event.clientY - (rect?.top ?? 0),
            roadId: road.id,
            pointId: point.id,
          });
        });
        marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "center" });
        marker.on("drag", () => {
          const lngLat = marker!.getLngLat();
          handlersRef.current.onVertexMove(road.id, point.id, lngLat.lat, lngLat.lng);
        });
        marker.on("dragend", () => {
          const lngLat = marker!.getLngLat();
          handlersRef.current.onVertexMoveEnd(road.id, point.id, lngLat.lat, lngLat.lng);
        });
        marker.setLngLat([point.lng, point.lat]);
        marker.addTo(map);
        vertexExisting.set(point.id, marker);
      } else {
        marker.setLngLat([point.lng, point.lat]);
      }
    }
    for (const [id, marker] of vertexExisting) {
      if (!seen.has(id)) {
        marker.remove();
        vertexExisting.delete(id);
      }
    }

    // 中点はドラッグ対象ではないので、頂点構成が変わるたびに単純に作り直してよい
    midpointExisting.forEach((m) => m.remove());
    const nextMidpoints: maplibregl.Marker[] = [];
    for (let i = 0; i < road.points.length - 1; i += 1) {
      const a = road.points[i];
      const b = road.points[i + 1];
      const midLat = (a.lat + b.lat) / 2;
      const midLng = (a.lng + b.lng) / 2;
      const el = createMidpointElement();
      const index = i;
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        handlersRef.current.onMidpointInsert(road.id, index, midLat, midLng);
      });
      const marker = new maplibregl.Marker({ element: el, anchor: "center" });
      marker.setLngLat([midLng, midLat]);
      marker.addTo(map);
      nextMidpoints.push(marker);
    }
    midpointMarkersRef.current = nextMidpoints;
  }, [roads, selectedRoadId, tool, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource(SRC_SLOT_PREVIEW) as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: previewSlots.map((slot) => ({
        type: "Feature",
        properties: { status: slot.status },
        geometry: { type: "Point", coordinates: [slot.lng, slot.lat] },
      })),
    });
  }, [previewSlots, ready]);

  // 描いている道（線と、打った点）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const features: GeoJSON.Feature[] = draft.map((p) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
    }));
    if (draft.length >= 2) {
      features.push({
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: draft.map((p) => [p.lng, p.lat]) },
      });
    }
    (map.getSource(SRC_DRAFT) as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features });
    if (draft.length === 0) (map.getSource(SRC_DRAFT_CURSOR) as maplibregl.GeoJSONSource).setData(emptyFC());
  }, [draft, ready]);

  // 道を描く道具のあいだは、ダブルクリックでの拡大を止める（ダブルクリックは道の確定に使う）
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (tool === "drawRoad") map.doubleClickZoom.disable();
    else map.doubleClickZoom.enable();
    map.getCanvas().style.cursor = tool === "drawRoad" || tool === "placeLandmark" ? "crosshair" : "";
  }, [tool, ready]);

  // 頂点の右クリックメニューは、Esc か選んでいる道・道具が変わったら閉じる
  useEffect(() => {
    if (!vertexMenu) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeVertexMenu();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [vertexMenu, closeVertexMenu]);
  useEffect(() => closeVertexMenu(), [selectedRoadId, tool, closeVertexMenu]);

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

      {vertexMenu && (
        <>
          {/* メニューの外をクリックしたら閉じる */}
          <div
            style={{ position: "absolute", inset: 0 }}
            onClick={closeVertexMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeVertexMenu();
            }}
          />
          <div
            role="menu"
            style={{
              position: "absolute",
              left: vertexMenu.x,
              top: vertexMenu.y,
              background: EDITOR_COLORS.surface,
              border: `1px solid ${EDITOR_COLORS.border}`,
              borderRadius: 8,
              boxShadow: "0 4px 12px rgba(15,23,42,.2)",
              padding: 4,
              zIndex: 10,
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                handlersRef.current.onVertexRemove(vertexMenu.roadId, vertexMenu.pointId);
                closeVertexMenu();
              }}
              style={{
                display: "block",
                padding: "6px 12px",
                border: "none",
                background: "transparent",
                color: EDITOR_COLORS.ink,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              この点を削除
            </button>
          </div>
        </>
      )}

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
