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
    return {
      x: focus.x + (e.clientX - (rect.left + rect.width / 2)) / zoom,
      y: focus.y + (e.clientY - (rect.top + rect.height / 2)) / zoom,
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
    const dx = e.clientX - panRef.current.sx;
    const dy = e.clientY - panRef.current.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) moveStateRef.current.moved = true;
    setFocus({
      x: panRef.current.fx - dx / zoom,
      y: panRef.current.fy - dy / zoom,
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

  const worldTransform = `translate(-50%,-50%) scale(${zoom}) translate(${-focus.x}px, ${-focus.y}px)`;

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
      {/* 実際の地図をうっすら背景表示し、区画・道の位置合わせをしやすくする（操作は不可） */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
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
                  transform: `translate(-50%,-50%) scale(${1 / zoom})`,
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
                    const dx = (ev.clientX - startX) / zoom;
                    const dy = (ev.clientY - startY) / zoom;
                    const base = projection.toLocal(startLat, startLng);
                    const next = projection.toLatLng({ x: base.x + dx, y: base.y + dy });
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
                  transform: `translate(-50%,-50%) scale(${1 / zoom})`,
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
