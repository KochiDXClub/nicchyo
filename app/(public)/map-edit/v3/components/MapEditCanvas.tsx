"use client";

import dynamic from "next/dynamic";
import { useMemo, useRef } from "react";
import type { Projection } from "../geo";
import type {
  EditableLandmark,
  EditableRoad,
  EditableShop,
  LandmarkAction,
  RoadAction,
  SlotAction,
  Tab,
} from "../types";
import type { MapRoutePoint } from "../../../map/types/mapRoute";

export type CanvasHandlers = {
  onSelectShop: (locationId: string) => void;
  onSelectRoad: (roadId: string) => void;
  onSelectLandmark: (key: string) => void;
  onMoveLandmark: (key: string, lat: number, lng: number) => void;
  onMapClick: (lat: number, lng: number) => void;
  onVertexMove: (roadId: string, pointId: string, lat: number, lng: number) => void;
  onVertexMoveEnd: (roadId: string) => void;
  onVertexRemove: (roadId: string, pointId: string) => void;
  onMidpointInsert: (roadId: string, afterIndex: number, lat: number, lng: number) => void;
  onPan: (dx: number, dy: number) => void;
};

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
  landmarkAction: LandmarkAction;
  draft: { lat: number; lng: number }[];
  search: string;
  zoom: number;
  zoomIdx: number;
  focus: { x: number; y: number };
  setFocus: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  rotation: number;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
  dragging: boolean;
  setDragging: (value: boolean) => void;
  projection: Projection;
  handlers: CanvasHandlers;
  viewportRef: React.MutableRefObject<HTMLDivElement | null>;
  panRef: React.MutableRefObject<{ sx: number; sy: number; fx: number; fy: number } | null>;
  vertexDragRef: React.MutableRefObject<{ roadId: string; pointId: string } | null>;
  isLoading: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
};

// 左右それぞれ10度・30度分「加算」するボタン（タップした分だけ回転が積み重なる）
const ROTATION_STEPS = [-30, -10, 10, 30];

/** 画面上のベクトルを、地図の回転角ぶん逆回転させ「回転前のワールド座標系」でのベクトルに直す */
export function unrotateScreenDelta(dx: number, dy: number, rotationDeg: number) {
  const theta = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

/** 回転角を (-180, 180] の範囲に正規化する（何度も回転を加算しても値が際限なく増えないように） */
export function normalizeRotationDeg(deg: number): number {
  let normalized = deg % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized <= -180) normalized += 360;
  return normalized;
}

const LeafletBackground = dynamic(() => import("./LeafletBackground"), { ssr: false });

const ROAD_COLORS: Record<string, { color: string; casing: string }> = {
  market: { color: "#F6E1B4", casing: "#ffffff" },
  street: { color: "#ffffff", casing: "#E4DBC6" },
  path: { color: "#EFE7D6", casing: "#E4DBC6" },
};

export default function MapEditCanvas({
  tab,
  shops,
  roads,
  landmarks,
  selectedLocationId,
  selectedRoadId,
  selectedLandmarkKey,
  slotAction,
  roadAction,
  draft,
  search,
  zoom,
  zoomIdx,
  focus,
  setFocus,
  rotation,
  setRotation,
  dragging,
  setDragging,
  projection,
  handlers,
  viewportRef,
  panRef,
  vertexDragRef,
  isLoading,
  onZoomIn,
  onZoomOut,
}: Props) {
  const moveStateRef = useRef<{ moved: boolean }>({ moved: false });
  const q = search.trim().toLowerCase();

  const worldFromEvent = (e: { clientX: number; clientY: number }) => {
    const host = viewportRef.current;
    if (!host) return { x: focus.x, y: focus.y };
    const rect = host.getBoundingClientRect();
    const dxScreen = e.clientX - (rect.left + rect.width / 2);
    const dyScreen = e.clientY - (rect.top + rect.height / 2);
    const world = unrotateScreenDelta(dxScreen, dyScreen, rotation);
    return {
      x: focus.x + world.x / zoom,
      y: focus.y + world.y / zoom,
    };
  };

  const handleMapMouseDown = (e: React.MouseEvent) => {
    if (vertexDragRef.current) return;
    panRef.current = { sx: e.clientX, sy: e.clientY, fx: focus.x, fy: focus.y };
    moveStateRef.current.moved = false;
    setDragging(true);
  };

  const handleMapMouseMove = (e: React.MouseEvent) => {
    if (vertexDragRef.current) {
      const world = worldFromEvent(e);
      const latLng = projection.toLatLng(world);
      handlers.onVertexMove(vertexDragRef.current.roadId, vertexDragRef.current.pointId, latLng.lat, latLng.lng);
      return;
    }
    if (!panRef.current) return;
    const dxScreen = e.clientX - panRef.current.sx;
    const dyScreen = e.clientY - panRef.current.sy;
    if (Math.abs(dxScreen) + Math.abs(dyScreen) > 3) moveStateRef.current.moved = true;
    const world = unrotateScreenDelta(dxScreen, dyScreen, rotation);
    setFocus({
      x: panRef.current.fx - world.x / zoom,
      y: panRef.current.fy - world.y / zoom,
    });
  };

  const handleMapMouseUp = (e: React.MouseEvent) => {
    if (vertexDragRef.current) {
      const roadId = vertexDragRef.current.roadId;
      vertexDragRef.current = null;
      handlers.onVertexMoveEnd(roadId);
      return;
    }
    const wasClick = panRef.current && !moveStateRef.current.moved;
    panRef.current = null;
    if (dragging) setDragging(false);
    if (wasClick) {
      const world = worldFromEvent(e);
      const latLng = projection.toLatLng(world);
      handlers.onMapClick(latLng.lat, latLng.lng);
    }
  };

  const matchShop = (shop: EditableShop) =>
    !q || String(shop.position).includes(q) || shop.name.toLowerCase().includes(q);
  const matchRoad = (road: EditableRoad) => !q || road.name.toLowerCase().includes(q);

  const showNumbers = zoomIdx >= 2;
  const showDots = zoomIdx >= 1;

  // 画面中心を軸に回転させたのち、その回転済みの向きでpan/zoomする
  const worldTransform = `translate(-50%,-50%) rotate(${rotation}deg) scale(${zoom}) translate(${-focus.x}px, ${-focus.y}px)`;

  const roadPolylines = useMemo(
    () =>
      roads.map((road) => {
        const local = road.points.map((p) => projection.toLocal(p.lat, p.lng));
        return { road, local };
      }),
    [roads, projection]
  );

  return (
    <div
      ref={viewportRef}
      onMouseDown={handleMapMouseDown}
      onMouseMove={handleMapMouseMove}
      onMouseUp={handleMapMouseUp}
      onMouseLeave={handleMapMouseUp}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        position: "relative",
        overflow: "hidden",
        background: "#E9E3D5",
        cursor: roadAction === "draw" ? "crosshair" : dragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
    >
      {/* 実際の地図をうっすら背景表示し、区画・道の位置合わせをしやすくする（操作は不可）
          SVG側のワールドと同じ角度で回転させ、常に位置がズレないようにする */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}>
        <LeafletBackground center={projection.toLatLng(focus)} pixelsPerMeter={zoom} />
      </div>

      {isLoading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#9A8A6A", fontSize: 13 }}>
          読み込み中...
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transformOrigin: "0 0",
          transform: worldTransform,
          transition: dragging || vertexDragRef.current ? "none" : "transform .2s ease-out",
        }}
      >
        {/* 道 */}
        <svg
          style={{ position: "absolute", overflow: "visible", left: 0, top: 0, pointerEvents: "none" }}
        >
          {roadPolylines.map(({ road, local }) => {
            const isSelected = tab === "road" && selectedRoadId === road.id;
            const palette = ROAD_COLORS[road.kind] ?? ROAD_COLORS.street;
            const dim = tab === "road" && !matchRoad(road);
            const points = local.map((p) => `${p.x},${p.y}`).join(" ");
            return (
              <g key={road.id} opacity={dim ? 0.3 : 1}>
                <polyline
                  points={points}
                  fill="none"
                  stroke={isSelected ? "#B45309" : palette.casing}
                  strokeWidth={road.widthMeters + (isSelected ? 6 : 4)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={points}
                  fill="none"
                  stroke={isSelected ? "#FBCF8A" : palette.color}
                  strokeWidth={road.widthMeters}
                  strokeDasharray={road.kind === "path" ? "10 8" : "none"}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <polyline
                  points={points}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={Math.max(road.widthMeters + 10, 20)}
                  style={{ pointerEvents: tab === "road" && !dim ? "stroke" : "none", cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlers.onSelectRoad(road.id);
                  }}
                />
              </g>
            );
          })}

          {draft.length >= 2 && (
            <polyline
              points={draft
                .map((p) => projection.toLocal(p.lat, p.lng))
                .map((p) => `${p.x},${p.y}`)
                .join(" ")}
              fill="none"
              stroke="#92400E"
              strokeWidth={6}
              strokeDasharray="10 8"
              strokeLinecap="round"
            />
          )}

          {/* 道を描いている間、既存の点を接続先としてクリックできるように表示する */}
          {tab === "road" &&
            roadAction === "draw" &&
            roads.flatMap((road) =>
              road.points.map((point) => (
                <circle
                  key={`${road.id}-${point.id}`}
                  cx={projection.toLocal(point.lat, point.lng).x}
                  cy={projection.toLocal(point.lat, point.lng).y}
                  r={9 / zoom}
                  fill="#ffffffcc"
                  stroke="#92400E"
                  strokeWidth={2.5 / zoom}
                  style={{ pointerEvents: "all", cursor: "pointer" }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handlers.onMapClick(point.lat, point.lng);
                  }}
                />
              ))
            )}
        </svg>

        {/* 道の頂点・中点ハンドル。道を選択すればすぐにドラッグ・削除・追加ができる */}
        {tab === "road" && selectedRoadId && (
          <RoadShapeHandles
            road={roads.find((r) => r.id === selectedRoadId) ?? null}
            projection={projection}
            zoom={zoom}
            vertexDragRef={vertexDragRef}
            onVertexRemove={handlers.onVertexRemove}
            onMidpointInsert={handlers.onMidpointInsert}
          />
        )}

        {/* 区画ピン */}
        {tab === "slot" &&
          shops.map((shop) => {
            const local = projection.toLocal(shop.lat, shop.lng);
            const isSelected = selectedLocationId === shop.locationId;
            const match = matchShop(shop);
            const targetable = (slotAction === "move" || slotAction === "place") && !shop.vendorId;
            const size = showNumbers ? (isSelected ? 30 : 24) : showDots ? (isSelected ? 16 : 11) : 8;
            return (
              <div
                key={shop.locationId}
                onClick={(e) => {
                  e.stopPropagation();
                  handlers.onSelectShop(shop.locationId);
                }}
                style={{
                  position: "absolute",
                  left: local.x,
                  top: local.y,
                  // 地図の回転を打ち消し、番号が常に正立して読めるようにする
                  transform: `translate(-50%,-50%) rotate(${-rotation}deg) scale(${1 / zoom})`,
                  zIndex: isSelected ? 60 : targetable ? 40 : 20,
                  opacity: match ? 1 : 0.15,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    background: shop.vendorId ? (isSelected ? "#B45309" : "#D97706") : targetable ? "#FFF7E6" : "#FFFDF7",
                    color: "#fff",
                    border: shop.vendorId
                      ? isSelected
                        ? "3px solid #fff"
                        : "2px solid #fff"
                      : `2px dashed ${targetable ? "#B45309" : "#B5AA92"}`,
                    boxShadow: isSelected ? "0 0 0 4px rgba(180,83,9,.28)" : "0 1px 4px rgba(0,0,0,.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "monospace",
                    fontWeight: 800,
                    fontSize: 10,
                  }}
                >
                  {showNumbers ? shop.position : ""}
                </div>
              </div>
            );
          })}

        {/* 建物マーカー */}
        {(tab === "landmark" || landmarks.length > 0) &&
          landmarks.map((landmark) => {
            const local = projection.toLocal(landmark.lat, landmark.lng);
            const isSelected = tab === "landmark" && selectedLandmarkKey === landmark.key;
            const dim = tab === "landmark" && q && !landmark.name.toLowerCase().includes(q);
            return (
              <div
                key={landmark.key}
                onMouseDown={(e) => {
                  if (tab !== "landmark") return;
                  e.stopPropagation();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startLat = landmark.lat;
                  const startLng = landmark.lng;
                  const move = (ev: MouseEvent) => {
                    const world = unrotateScreenDelta(ev.clientX - startX, ev.clientY - startY, rotation);
                    const base = projection.toLocal(startLat, startLng);
                    const next = projection.toLatLng({ x: base.x + world.x / zoom, y: base.y + world.y / zoom });
                    handlers.onMoveLandmark(landmark.key, next.lat, next.lng);
                  };
                  const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", up);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (tab === "landmark") handlers.onSelectLandmark(landmark.key);
                }}
                style={{
                  position: "absolute",
                  left: local.x,
                  top: local.y,
                  // 地図の回転を打ち消し、名称ラベルが常に正立して読めるようにする
                  transform: `translate(-50%,-50%) rotate(${-rotation}deg) scale(${1 / zoom})`,
                  zIndex: isSelected ? 55 : 15,
                  opacity: tab === "landmark" ? (dim ? 0.25 : 1) : 0.55,
                  cursor: tab === "landmark" ? "grab" : "default",
                }}
              >
                <div
                  style={{
                    padding: "3px 8px",
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    background: isSelected ? "#92400E" : "#ffffffee",
                    color: isSelected ? "#fff" : "#57503F",
                    border: "1px solid #E0B877",
                    boxShadow: "0 1px 4px rgba(0,0,0,.2)",
                  }}
                >
                  🏛️ {landmark.name}
                </div>
              </div>
            );
          })}
      </div>

      <div style={{ position: "absolute", bottom: 12, right: 12, display: "flex", flexDirection: "column", background: "#fff", borderRadius: 11, boxShadow: "0 2px 8px rgba(15,23,42,.18)", overflow: "hidden" }}>
        <span onClick={onZoomIn} style={{ padding: "9px 13px", fontSize: 16, fontWeight: 700, cursor: "pointer", color: "#92400E", textAlign: "center" }}>
          ＋
        </span>
        <span onClick={onZoomOut} style={{ padding: "9px 13px", fontSize: 16, fontWeight: 700, cursor: "pointer", color: "#92400E", textAlign: "center" }}>
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

/**
 * マップの回転コントロール。コンパスの下半円のように、中央下（リセットボタン）を
 * 起点に左右へ10度・30度分カーブして並んだボタンを配置する。左右のボタンは
 * タップするたびにその分だけ現在の回転角に「加算」していく（例: 右10を2回で右へ20度）。
 * 中央のボタンは初期角度（0度）に戻すリセット用。
 */
function RotationControl({
  rotation,
  setRotation,
}: {
  rotation: number;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
}) {
  const radius = 44;
  const width = 140;
  const displayDeg = Math.round(normalizeRotationDeg(rotation));

  return (
    <div style={{ position: "relative", width, height: 78 }}>
      {[...ROTATION_STEPS.filter((d) => d < 0), 0, ...ROTATION_STEPS.filter((d) => d > 0)].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const x = width / 2 + radius * Math.sin(rad);
        const y = radius * Math.cos(rad);
        const isReset = deg === 0;
        const isAtInitial = isReset && displayDeg === 0;
        return (
          <button
            key={deg}
            type="button"
            onClick={() =>
              isReset
                ? setRotation(0)
                : setRotation((prev) => normalizeRotationDeg(prev + deg))
            }
            title={isReset ? "初期角度に戻す" : `${deg > 0 ? "右" : "左"}へ${Math.abs(deg)}度回転（タップするたびに加算）`}
            style={{
              position: "absolute",
              left: x,
              top: y,
              transform: "translate(-50%,-50%)",
              width: isReset ? 32 : 28,
              height: isReset ? 32 : 28,
              borderRadius: "50%",
              border: isAtInitial ? "2px solid #92400E" : "1px solid #E4D9BF",
              background: isAtInitial ? "#92400E" : "#FDFBF5",
              color: isAtInitial ? "#fff" : "#57503F",
              fontSize: isReset ? 13 : 10,
              fontWeight: 800,
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isReset ? "◎" : `${deg > 0 ? "+" : ""}${deg}`}
          </button>
        );
      })}
      <div style={{ position: "absolute", left: "50%", top: 66, transform: "translateX(-50%)", fontSize: 10.5, fontWeight: 700, color: "#9A8A6A", whiteSpace: "nowrap" }}>
        {displayDeg}°
      </div>
    </div>
  );
}

function RoadShapeHandles({
  road,
  projection,
  zoom,
  vertexDragRef,
  onVertexRemove,
  onMidpointInsert,
}: {
  road: EditableRoad | null;
  projection: Projection;
  zoom: number;
  vertexDragRef: React.MutableRefObject<{ roadId: string; pointId: string } | null>;
  onVertexRemove: (roadId: string, pointId: string) => void;
  onMidpointInsert: (roadId: string, afterIndex: number, lat: number, lng: number) => void;
}) {
  if (!road) return null;
  const points = road.points;

  return (
    <>
      {points.map((point: MapRoutePoint) => {
        const local = projection.toLocal(point.lat, point.lng);
        return (
          <div
            key={point.id}
            onMouseDown={(e) => {
              e.stopPropagation();
              vertexDragRef.current = { roadId: road.id, pointId: point.id };
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onVertexRemove(road.id, point.id);
            }}
            style={{
              position: "absolute",
              left: local.x,
              top: local.y,
              transform: `translate(-50%,-50%) scale(${1 / zoom})`,
              width: 18,
              height: 18,
              borderRadius: 5,
              background: "#fff",
              border: "3px solid #B45309",
              boxShadow: "0 2px 6px rgba(0,0,0,.3)",
              cursor: "grab",
              zIndex: 90,
            }}
          />
        );
      })}
      {points.slice(0, -1).map((point, index) => {
        const next = points[index + 1];
        const midLat = (point.lat + next.lat) / 2;
        const midLng = (point.lng + next.lng) / 2;
        const local = projection.toLocal(midLat, midLng);
        return (
          <div
            key={`mid-${point.id}`}
            onMouseDown={(e) => {
              e.stopPropagation();
              onMidpointInsert(road.id, index, midLat, midLng);
            }}
            style={{
              position: "absolute",
              left: local.x,
              top: local.y,
              transform: `translate(-50%,-50%) scale(${1 / zoom})`,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#FFF7E6",
              border: "2px dashed #B45309",
              color: "#92400E",
              fontSize: 10,
              fontWeight: 900,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "copy",
              zIndex: 85,
            }}
          >
            ＋
          </div>
        );
      })}
    </>
  );
}
