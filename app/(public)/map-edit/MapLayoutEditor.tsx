"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Trash2 } from "lucide-react";
import type { Landmark as EditableLandmark } from "../map/types/landmark";
import type { Shop } from "../map/data/shops";
import type { MapRouteConfig, MapRoutePoint } from "../map/types/mapRoute";
import RoadOverlay from "../map/components/RoadOverlay";
import BackgroundOverlay from "../map/components/BackgroundOverlay";
import OptimizedShopLayerWithClustering from "../map/components/OptimizedShopLayerWithClustering";
import { normalizeRotationDeg } from "../map/utils/autoRotation";
import {
  getRouteCenter,
  getRoutePointRole,
  getRouteSegments,
  normalizeMapRoutePoints,
} from "../map/utils/mapRouteGeometry";

type EditableShop = {
  locationId: string;
  id: number;
  vendorId?: string;
  name: string;
  lat: number;
  lng: number;
};

type Props = {
  mode: "edit" | "preview";
  shops: EditableShop[];
  landmarks: EditableLandmark[];
  routePoints: MapRoutePoint[];
  routeConfig: MapRouteConfig;
  interactionHint?: string;
  maxZoom?: number;
  selectedKind: "shop" | "landmark" | "route";
  selectedId: string;
  onSelect: (kind: "shop" | "landmark" | "route", id: string) => void;
  onClearSelection: () => void;
  onMoveShop: (id: number, lat: number, lng: number) => void;
  onMoveLandmark: (key: string, lat: number, lng: number) => void;
  onMoveRoutePoint: (id: string, lat: number, lng: number) => void;
  onInsertRoutePointAtSegment: (
    segmentStartId: string,
    lat: number,
    lng: number,
    segmentEndId?: string
  ) => void;
  onAddConnectedRoutePoint: (pointId: string, branchDirection?: "up" | "down" | "auto") => void;
  onDeleteShop: (id: number) => void;
  onDeleteLandmark: (key: string) => void;
  onDeleteRoutePoint: (id: string) => void;
};

function ClickCapture({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event) {
      onClick(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

const TOUCH_ROTATION_ANGLE_THRESHOLD_DEG = 4;
const TOUCH_PINCH_DISTANCE_THRESHOLD_PX = 8;
const PAN_START_THRESHOLD_PX = 3;

function getTouchDistance(
  t0: { clientX: number; clientY: number },
  t1: { clientX: number; clientY: number }
): number {
  return Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
}

function rotateVector(x: number, y: number, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function isInteractiveMapElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      ".leaflet-marker-icon, .leaflet-popup, .leaflet-control, button, input, select, textarea, a"
    )
  );
}

function createMarkerIcon(
  kind: "shop" | "landmark" | "route",
  isSelected: boolean,
  isUnassigned = false,
  isIncompleteLandmark = false
) {
  const size = isSelected ? 26 : 18;
  const borderRadius = kind === "shop" ? "9999px" : "6px";
  const background =
    kind === "shop"
      ? (isUnassigned ? "#94a3b8" : "#0284c7")
      : kind === "route"
        ? "#111827"
        : (isIncompleteLandmark ? "#c7926a" : "#f97316");
  const glow =
    kind === "shop"
      ? isUnassigned
        ? "rgba(148,163,184,.38)"
        : "rgba(2,132,199,.38)"
      : kind === "route"
        ? "rgba(15,23,42,.38)"
        : (isIncompleteLandmark ? "rgba(199,146,106,.38)" : "rgba(249,115,22,.38)");
  const outline = isSelected ? "0 0 0 6px rgba(255,255,255,.95), 0 0 0 10px rgba(15,23,42,.14)" : "";

  return L.divIcon({
    className: "custom-map-edit-icon",
    html: `<div style="width:${size}px;height:${size}px;border-radius:${borderRadius};background:${background};border:3px solid white;box-shadow:${outline ? `${outline}, ` : ""}0 6px 16px ${glow};transform:${isSelected ? "scale(1.05)" : "scale(1)"};"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createMidpointHandleIcon() {
  return L.divIcon({
    className: "custom-route-midpoint-icon",
    html: `
      <div style="width:18px;height:18px;border-radius:9999px;background:#ffffff;border:2px solid #0f172a;box-shadow:0 4px 12px rgba(15,23,42,.18);display:flex;align-items:center;justify-content:center;">
        <div style="position:relative;width:8px;height:8px;">
          <span style="position:absolute;left:3px;top:0;width:2px;height:8px;background:#0f172a;border-radius:9999px;"></span>
          <span style="position:absolute;left:0;top:3px;width:8px;height:2px;background:#0f172a;border-radius:9999px;"></span>
        </div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

export default function MapLayoutEditor({
  mode,
  shops,
  landmarks,
  routePoints,
  routeConfig,
  interactionHint,
  maxZoom = 20,
  selectedKind,
  selectedId,
  onSelect,
  onClearSelection,
  onMoveShop,
  onMoveLandmark,
  onMoveRoutePoint,
  onInsertRoutePointAtSegment,
  onAddConnectedRoutePoint,
  onDeleteShop,
  onDeleteLandmark,
  onDeleteRoutePoint,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const [manualRotationOffset, setManualRotationOffset] = useState(0);
  const [isTouchRotating, setIsTouchRotating] = useState(false);
  const [isMultiTouchGesture, setIsMultiTouchGesture] = useState(false);
  const [mapShellSize, setMapShellSize] = useState(() => {
    if (typeof window === "undefined") return 1600;
    return Math.ceil(Math.hypot(window.innerWidth, window.innerHeight) + 120);
  });
  const touchRotateRef = useRef<{
    startAngle: number;
    startDistance: number;
    startRotation: number;
    isRotating: boolean;
  } | null>(null);
  const touchPanRef = useRef<{
    lastX: number;
    lastY: number;
    hasMoved: boolean;
  } | null>(null);
  const mousePanRef = useRef<{
    lastX: number;
    lastY: number;
    isPanning: boolean;
  } | null>(null);
  const center = useMemo<[number, number]>(() => {
    const normalizedRoutePoints = normalizeMapRoutePoints(routePoints);
    if (normalizedRoutePoints.length >= 2) {
      return getRouteCenter(normalizedRoutePoints);
    }
    const first = shops[0] ?? landmarks[0];
    return first ? [first.lat, first.lng] : [33.56145, 133.5383];
  }, [landmarks, routePoints, shops]);
  const mapRotation = normalizeRotationDeg(manualRotationOffset);
  const shopIcons = useMemo(() => {
    const icons = new Map<number, L.DivIcon>();
    for (const shop of shops) {
      icons.set(
        shop.id,
        createMarkerIcon(
          "shop",
          selectedKind === "shop" && selectedId === String(shop.id),
          !shop.vendorId
        )
      );
    }
    return icons;
  }, [selectedId, selectedKind, shops]);
  const landmarkIcons = useMemo(() => {
    const icons = new Map<string, L.DivIcon>();
    for (const landmark of landmarks) {
      const isIncomplete = !landmark.name.trim() || !landmark.url.trim();
      icons.set(
        landmark.key,
        createMarkerIcon(
          "landmark",
          selectedKind === "landmark" && selectedId === landmark.key,
          false,
          isIncomplete
        )
      );
    }
    return icons;
  }, [landmarks, selectedId, selectedKind]);
  const previewShops = useMemo<Shop[]>(
    () =>
      shops
        .filter((shop) => shop.vendorId)
        .map((shop) => ({
        id: shop.id,
        vendorId: shop.vendorId,
        name: shop.name,
        ownerName: "",
        category: "",
        products: [],
        description: "",
        schedule: "",
        position: shop.id,
        lat: shop.lat,
        lng: shop.lng,
      })),
    [shops]
  );
  const previewLandmarkIcons = useMemo(() => {
    const icons = new Map<string, L.DivIcon>();
    for (const landmark of landmarks) {
      const width = Math.max(24, Math.round(landmark.widthPx * 0.36));
      const height = Math.max(24, Math.round(landmark.heightPx * 0.36));
      icons.set(
        landmark.key,
        L.divIcon({
          className: "map-landmark-icon",
          html: `<img class="map-landmark-visual" src="${landmark.url}" alt="" draggable="false" style="width:${width}px;height:${height}px;opacity:1;" />`,
          iconSize: [width, height],
          iconAnchor: [width / 2, height / 2],
        })
      );
    }
    return icons;
  }, [landmarks]);
  const routeSegments = useMemo(
    () => getRouteSegments(routePoints),
    [routePoints]
  );
  const routeMidpointIcon = useMemo(() => createMidpointHandleIcon(), []);

  const applyManualRotation = useCallback((nextRotation: number) => {
    setManualRotationOffset(normalizeRotationDeg(nextRotation));
  }, []);

  const panMapByScreenDelta = useCallback(
    (dx: number, dy: number) => {
      const map = mapRef.current;
      if (!map) return;
      const adjusted = rotateVector(-dx, -dy, -mapRotation);
      map.panBy([adjusted.x, adjusted.y], {
        animate: false,
        noMoveStart: true,
      });
    },
    [mapRotation]
  );

  const handleTouchStartRotate = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (isInteractiveMapElement(e.target)) return;
      if (e.touches.length === 1) {
        setIsMultiTouchGesture(false);
        const touch = e.touches[0];
        touchPanRef.current = {
          lastX: touch.clientX,
          lastY: touch.clientY,
          hasMoved: false,
        };
        touchRotateRef.current = null;
        setIsTouchRotating(false);
        return;
      }
      if (e.touches.length !== 2) return;
      setIsMultiTouchGesture(true);
      touchPanRef.current = null;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);
      const distance = getTouchDistance(t0, t1);
      touchRotateRef.current = {
        startAngle: angle,
        startDistance: distance,
        startRotation: mapRotation,
        isRotating: false,
      };
    },
    [mapRotation]
  );

  const handleTouchMoveRotate = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (e.touches.length === 1 && touchPanRef.current && !isTouchRotating) {
        const touch = e.touches[0];
        const dx = touch.clientX - touchPanRef.current.lastX;
        const dy = touch.clientY - touchPanRef.current.lastY;
        if (!touchPanRef.current.hasMoved && Math.hypot(dx, dy) < PAN_START_THRESHOLD_PX) {
          return;
        }
        touchPanRef.current.hasMoved = true;
        touchPanRef.current.lastX = touch.clientX;
        touchPanRef.current.lastY = touch.clientY;
        e.preventDefault();
        panMapByScreenDelta(dx, dy);
        return;
      }

      if (e.touches.length !== 2 || !touchRotateRef.current) return;
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const angle = Math.atan2(t1.clientY - t0.clientY, t1.clientX - t0.clientX);
      const deltaDeg = ((angle - touchRotateRef.current.startAngle) * 180) / Math.PI;
      const distance = getTouchDistance(t0, t1);
      const distanceDelta = distance - touchRotateRef.current.startDistance;

      if (!touchRotateRef.current.isRotating) {
        if (
          Math.abs(deltaDeg) < TOUCH_ROTATION_ANGLE_THRESHOLD_DEG &&
          Math.abs(distanceDelta) < TOUCH_PINCH_DISTANCE_THRESHOLD_PX
        ) {
          return;
        }
        if (
          Math.abs(deltaDeg) <= TOUCH_ROTATION_ANGLE_THRESHOLD_DEG ||
          Math.abs(deltaDeg) * 2 < Math.abs(distanceDelta)
        ) {
          return;
        }
        touchRotateRef.current.isRotating = true;
        setIsTouchRotating(true);
      }

      e.preventDefault();
      e.stopPropagation();
      applyManualRotation(touchRotateRef.current.startRotation + deltaDeg);
    },
    [applyManualRotation, isTouchRotating, panMapByScreenDelta]
  );

  const handleTouchEndRotate = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    setIsMultiTouchGesture(e.touches.length >= 2);
    if (e.touches.length < 2) {
      touchRotateRef.current = null;
      setIsTouchRotating(false);
    }
    if (e.touches.length === 0) {
      touchPanRef.current = null;
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchPanRef.current = {
        lastX: touch.clientX,
        lastY: touch.clientY,
        hasMoved: false,
      };
    }
  }, []);

  const handleMouseDownPan = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (isInteractiveMapElement(e.target)) return;
    mousePanRef.current = {
      lastX: e.clientX,
      lastY: e.clientY,
      isPanning: false,
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setMapShellSize(Math.ceil(Math.hypot(window.innerWidth, window.innerHeight) + 120));
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!mousePanRef.current || isTouchRotating) return;
      const dx = e.clientX - mousePanRef.current.lastX;
      const dy = e.clientY - mousePanRef.current.lastY;
      if (!mousePanRef.current.isPanning && Math.hypot(dx, dy) < PAN_START_THRESHOLD_PX) {
        return;
      }
      mousePanRef.current.isPanning = true;
      mousePanRef.current.lastX = e.clientX;
      mousePanRef.current.lastY = e.clientY;
      panMapByScreenDelta(dx, dy);
    };
    const handleUp = () => {
      mousePanRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isTouchRotating, panMapByScreenDelta]);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{
        ["--map-rotation-inverse" as string]: `${-mapRotation}deg`,
      }}
    >
      <div
        className="absolute left-1/2 top-1/2 z-0"
        onTouchStart={handleTouchStartRotate}
        onTouchMove={handleTouchMoveRotate}
        onTouchEnd={handleTouchEndRotate}
        onTouchCancel={handleTouchEndRotate}
        onMouseDown={handleMouseDownPan}
        style={{
          width: `${mapShellSize}px`,
          height: `${mapShellSize}px`,
          touchAction: "none",
          transform: `translate(-50%, -50%) rotate(${mapRotation}deg)`,
          transformOrigin: "center center",
          transition: isTouchRotating ? "none" : "transform 1600ms ease-out",
        }}
      >
        {mode === "edit" && interactionHint ? (
          <div className="pointer-events-none absolute left-1/2 top-5 z-[500] w-[min(92%,560px)] -translate-x-1/2 rounded-2xl border border-white/70 bg-white/92 px-4 py-3 text-center text-sm text-slate-700 shadow-lg backdrop-blur">
            {interactionHint}
          </div>
        ) : null}
        <MapContainer
          center={center}
          zoom={17}
          maxZoom={maxZoom}
          zoomSnap={0.2}
          zoomDelta={0.35}
          wheelPxPerZoomLevel={130}
          zoomAnimation
          markerZoomAnimation
          fadeAnimation
          className="h-full w-full"
          scrollWheelZoom
          dragging={false}
          touchZoom={isMultiTouchGesture || isTouchRotating ? false : "center"}
          style={{
            height: "100%",
            width: "100%",
            backgroundColor: "#faf8f3",
          }}
          ref={(map) => {
            mapRef.current = map;
          }}
        >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
          maxZoom={maxZoom}
        />
        {mode === "preview" ? (
          <>
            <BackgroundOverlay />
            <RoadOverlay routePoints={routePoints} routeConfig={routeConfig} />
            {landmarks.map((landmark) => (
              <Marker
                key={landmark.key}
                position={[landmark.lat, landmark.lng]}
                icon={previewLandmarkIcons.get(landmark.key) ?? createMarkerIcon("landmark", false)}
              />
            ))}
            <OptimizedShopLayerWithClustering
              shops={previewShops}
              onShopClick={() => {}}
            />
          </>
        ) : (
          <>
            <BackgroundOverlay />
            <RoadOverlay routePoints={routePoints} routeConfig={routeConfig} />
            {selectedKind === "route" &&
              routeSegments.map((segment) => (
                <Polyline
                  key={`route-segment-${segment.start.id}-${segment.end.id}`}
                  positions={[
                    [segment.start.lat, segment.start.lng],
                    [segment.end.lat, segment.end.lng],
                  ]}
                  pathOptions={{
                    color: "#0f172a",
                    weight: 2,
                    opacity: 0.28,
                    dashArray: "8 10",
                    lineCap: "round",
                    lineJoin: "round",
                  }}
                />
              ))}
            {selectedKind === "route" &&
              routeSegments.map((segment) => {
                const midpointLat = (segment.start.lat + segment.end.lat) / 2;
                const midpointLng = (segment.start.lng + segment.end.lng) / 2;
                return (
                  <Marker
                    key={`route-midpoint-${segment.start.id}-${segment.end.id}`}
                    position={[midpointLat, midpointLng]}
                    icon={routeMidpointIcon}
                    eventHandlers={{
                      click: (event) => {
                        L.DomEvent.stopPropagation(event);
                        onInsertRoutePointAtSegment(
                          segment.start.id,
                          midpointLat,
                          midpointLng,
                          segment.end.id
                        );
                      },
                    }}
                  />
                );
              })}
            <ClickCapture
              onClick={() => {
                onClearSelection();
              }}
            />
            {shops.map((shop) => (
              <Marker
                key={shop.id}
                position={[shop.lat, shop.lng]}
                icon={shopIcons.get(shop.id) ?? createMarkerIcon("shop", false, !shop.vendorId)}
                draggable={selectedKind === "shop" && selectedId === String(shop.id)}
                eventHandlers={{
                  click: () => onSelect("shop", String(shop.id)),
                  dragend: (event) => {
                    const marker = event.target;
                    const latlng = marker.getLatLng();
                    onMoveShop(shop.id, latlng.lat, latlng.lng);
                  },
                }}
              >
                <Popup className="map-edit-marker-popup" closeButton={false} offset={[0, -12]}>
                  <div className="min-w-[180px]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Shop</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">{shop.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">#{shop.id}</p>
                        {!shop.vendorId && (
                          <p className="mt-1 text-xs font-medium text-slate-400">出店者未割当</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteShop(shop.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                        aria-label={`${shop.name} を削除`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {shop.lat.toFixed(6)}, {shop.lng.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {landmarks.map((landmark) => (
              <Marker
                key={landmark.key}
                position={[landmark.lat, landmark.lng]}
                icon={
                  landmarkIcons.get(landmark.key) ??
                  createMarkerIcon("landmark", false, false, !landmark.name.trim() || !landmark.url.trim())
                }
                draggable={selectedKind === "landmark" && selectedId === landmark.key}
                eventHandlers={{
                  click: () => onSelect("landmark", landmark.key),
                  dragend: (event) => {
                    const marker = event.target;
                    const latlng = marker.getLatLng();
                    onMoveLandmark(landmark.key, latlng.lat, latlng.lng);
                  },
                }}
              >
                <Popup className="map-edit-marker-popup" closeButton={false} offset={[0, -12]}>
                  <div className="min-w-[180px]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Landmark</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">{landmark.name}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteLandmark(landmark.key)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                        aria-label={`${landmark.name} を削除`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {landmark.lat.toFixed(6)}, {landmark.lng.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
            {routePoints.map((point, index) => (
              (() => {
                const pointRole = getRoutePointRole(routePoints, point.id);
                const isMiddleMainPoint = pointRole === "main-middle";

                return (
              <Marker
                key={point.id}
                position={[point.lat, point.lng]}
                icon={createMarkerIcon("route", selectedKind === "route" && selectedId === point.id)}
                draggable={selectedKind === "route" && selectedId === point.id}
                eventHandlers={{
                  click: () => onSelect("route", point.id),
                  dragend: (event) => {
                    const marker = event.target;
                    const latlng = marker.getLatLng();
                    onMoveRoutePoint(point.id, latlng.lat, latlng.lng);
                  },
                }}
              >
                <Popup className="map-edit-marker-popup" closeButton={false} offset={[0, -12]}>
                  <div className="min-w-[180px]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Route</p>
                        <h3 className="mt-1 text-sm font-semibold text-slate-900">ポイント {index + 1}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteRoutePoint(point.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                        aria-label={`道路ポイント ${index + 1} を削除`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {isMiddleMainPoint ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => onAddConnectedRoutePoint(point.id, "up")}
                          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          上に道を追加
                        </button>
                        <button
                          type="button"
                          onClick={() => onAddConnectedRoutePoint(point.id, "down")}
                          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          下に道を追加
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAddConnectedRoutePoint(point.id, "auto")}
                        className="mt-3 w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        ここから道を追加
                      </button>
                    )}
                    <p className="mt-3 text-xs leading-5 text-slate-500">
                      {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                    </p>
                  </div>
                </Popup>
              </Marker>
                );
              })()
            ))}
          </>
        )}
        </MapContainer>
      </div>
    </div>
  );
}
