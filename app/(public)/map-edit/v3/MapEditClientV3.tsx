"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  distanceMeters,
  findNearestRoadId as findNearestRoadIdShared,
  getDefaultMapRouteConfig,
  getRouteCenter,
} from "../../map/utils/mapRouteGeometry";
import type { MapRouteConfig, MapRoutePoint, RoadKind } from "../../map/types/mapRoute";
import { createProjection } from "./geo";
import { pointAtT, offsetLatLng } from "./roadPlacement";
import {
  ROAD_KIND_DEFAULT_WIDTH,
  ROAD_KIND_LABELS,
  type EditableLandmark,
  type EditableRoad,
  type EditableShop,
  type LandmarkAction,
  type PendingChange,
  type PendingChangeSnapshot,
  type RoadAction,
  type SlotAction,
  type SnapshotItem,
  type Tab,
  type VendorOption,
} from "./types";
import MapEditCanvas, { type CanvasHandlers } from "./components/MapEditCanvas";
import { SlotDetailPanel, RoadDetailPanel, LandmarkDetailPanel } from "./components/DetailPanels";
import PendingChangeLog from "./components/PendingChangeLog";
import RoadLaneView, { buildLaneRoadGroups, type LaneRoadGroup } from "./components/RoadLaneView";

const ZOOMS = [1.2, 3.5, 12];
const MAX_ZOOM_IDX = ZOOMS.length - 1;
// 道を描いている途中、既存の点からこの距離（メートル）以内をクリックしたら
// その点にスナップして接続する
const POINT_SNAP_DISTANCE_METERS = 6;

function cloneShops(shops: EditableShop[]) {
  return shops.map((shop) => ({ ...shop }));
}
function cloneLandmarks(landmarks: EditableLandmark[]) {
  return landmarks.map((landmark) => ({ ...landmark }));
}
function cloneRoads(roads: EditableRoad[]) {
  return roads.map((road) => ({ ...road, points: road.points.map((p) => ({ ...p })) }));
}

type MapSettingsLimits = {
  maxLandmarks: number;
  maxUnassignedShopMarkers: number;
};

const DEFAULT_MAP_SETTINGS_LIMITS: MapSettingsLimits = {
  maxLandmarks: 80,
  maxUnassignedShopMarkers: 40,
};

async function fetchMapLayout() {
  const response = await fetch("/api/admin/map-layout");
  if (!response.ok) throw new Error("failed");
  return response.json() as Promise<{
    shops?: EditableShop[];
    landmarks?: EditableLandmark[];
    route?: { points: MapRoutePoint[]; config: MapRouteConfig };
    roads?: EditableRoad[];
    vendors?: VendorOption[];
    mapSettingsLimits?: MapSettingsLimits;
  }>;
}

let pendingIdCounter = 0;

export default function MapEditClientV3() {
  const [tab, setTab] = useState<Tab>("slot");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [shops, setShops] = useState<EditableShop[]>([]);
  const [landmarks, setLandmarks] = useState<EditableLandmark[]>([]);
  const [roads, setRoads] = useState<EditableRoad[]>([]);
  const [routeConfig, setRouteConfig] = useState<MapRouteConfig>(getDefaultMapRouteConfig());
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([]);
  const [mapSettingsLimits, setMapSettingsLimits] = useState<MapSettingsLimits>(DEFAULT_MAP_SETTINGS_LIMITS);

  const [initialShops, setInitialShops] = useState<EditableShop[]>([]);
  const [initialLandmarks, setInitialLandmarks] = useState<EditableLandmark[]>([]);
  const [initialRoads, setInitialRoads] = useState<EditableRoad[]>([]);

  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedRoadId, setSelectedRoadId] = useState<string | null>(null);
  const [selectedLandmarkKey, setSelectedLandmarkKey] = useState<string | null>(null);

  const [slotAction, setSlotAction] = useState<SlotAction>("idle");
  const [roadAction, setRoadAction] = useState<RoadAction>("idle");
  const [landmarkAction, setLandmarkAction] = useState<LandmarkAction>("idle");
  const [draft, setDraft] = useState<{ lat: number; lng: number }[]>([]);
  const [drawAxis, setDrawAxis] = useState<"h" | "v" | "free">("h");

  const [search, setSearch] = useState("");
  const [pending, setPending] = useState<PendingChange[]>([]);

  const [zoomIdx, setZoomIdx] = useState(1);
  const [focus, setFocus] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const [snapshots, setSnapshots] = useState<SnapshotItem[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const originRef = useRef<{ lat: number; lng: number } | null>(null);
  const vertexDragRef = useRef<{ roadId: string; pointId: string } | null>(null);
  const panRef = useRef<{ sx: number; sy: number; fx: number; fy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const log = useCallback((label: string, text: string, before?: PendingChangeSnapshot) => {
    pendingIdCounter += 1;
    setPending((prev) => [{ id: pendingIdCounter, label, text, before }, ...prev]);
  }, []);

  // ── データ取得 ──────────────────────────────────────────
  useEffect(() => {
    let active = true;
    void fetchMapLayout()
      .then((data) => {
        if (!active) return;
        const nextShops = Array.isArray(data.shops) ? data.shops : [];
        const nextLandmarks = Array.isArray(data.landmarks) ? data.landmarks : [];
        const nextRoads = Array.isArray(data.roads) ? data.roads : [];
        const nextConfig = { ...getDefaultMapRouteConfig(), ...(data.route?.config ?? {}) };
        const nextVendors = Array.isArray(data.vendors) ? data.vendors : [];

        setShops(nextShops);
        setLandmarks(nextLandmarks);
        setRoads(nextRoads);
        setRouteConfig(nextConfig);
        setVendorOptions(nextVendors);
        if (data.mapSettingsLimits) setMapSettingsLimits(data.mapSettingsLimits);
        setInitialShops(cloneShops(nextShops));
        setInitialLandmarks(cloneLandmarks(nextLandmarks));
        setInitialRoads(cloneRoads(nextRoads));

        const allPoints = nextRoads.flatMap((road) => road.points);
        const center = getRouteCenter(allPoints);
        originRef.current = { lat: center[0], lng: center[1] };
        setFocus({ x: 0, y: 0 });
      })
      .catch(() => {
        if (active) setMessage("マップ編集データの取得に失敗しました。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const projection = useMemo(() => {
    const origin = originRef.current ?? { lat: 0, lng: 0 };
    return createProjection(origin.lat, origin.lng);
  }, [roads.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 差分判定 ──────────────────────────────────────────
  const hasUnsavedChanges = useMemo(() => {
    const initialShopMap = new Map(initialShops.map((s) => [s.locationId, s]));
    const currentShopMap = new Map(shops.map((s) => [s.locationId, s]));
    const shopChanged = shops.some((shop) => {
      const initial = initialShopMap.get(shop.locationId);
      if (!initial) return true;
      return (
        initial.lat !== shop.lat ||
        initial.lng !== shop.lng ||
        initial.position !== shop.position ||
        initial.vendorId !== shop.vendorId
      );
    });
    const shopDeleted = initialShops.some((s) => !currentShopMap.has(s.locationId));

    const initialLandmarkMap = new Map(initialLandmarks.map((l) => [l.key, l]));
    const currentLandmarkMap = new Map(landmarks.map((l) => [l.key, l]));
    const landmarkChanged = landmarks.some((landmark) => {
      const initial = initialLandmarkMap.get(landmark.key);
      if (!initial) return true;
      return (
        initial.name !== landmark.name ||
        initial.description !== landmark.description ||
        initial.url !== landmark.url ||
        initial.lat !== landmark.lat ||
        initial.lng !== landmark.lng ||
        initial.widthPx !== landmark.widthPx ||
        initial.heightPx !== landmark.heightPx ||
        initial.showAtMinZoom !== landmark.showAtMinZoom
      );
    });
    const landmarkDeleted = initialLandmarks.some((l) => !currentLandmarkMap.has(l.key));

    const roadsChanged = JSON.stringify(roads) !== JSON.stringify(initialRoads);

    return shopChanged || shopDeleted || landmarkChanged || landmarkDeleted || roadsChanged;
  }, [shops, initialShops, landmarks, initialLandmarks, roads, initialRoads]);

  // ── 保存 ──────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const initialShopMap = new Map(initialShops.map((s) => [s.locationId, s]));
      const updatedShops = shops.filter((shop) => {
        const initial = initialShopMap.get(shop.locationId);
        if (!initial) return true;
        return (
          initial.lat !== shop.lat ||
          initial.lng !== shop.lng ||
          initial.position !== shop.position ||
          initial.vendorId !== shop.vendorId
        );
      });
      const currentShopIds = new Set(shops.map((s) => s.locationId));
      const deletedLocationIds = initialShops
        .filter((s) => !currentShopIds.has(s.locationId))
        .map((s) => s.locationId);

      const initialLandmarkMap = new Map(initialLandmarks.map((l) => [l.key, l]));
      const upsertLandmarks = landmarks.filter((landmark) => {
        const initial = initialLandmarkMap.get(landmark.key);
        if (!initial) return true;
        return JSON.stringify(initial) !== JSON.stringify(landmark);
      });
      const currentLandmarkKeys = new Set(landmarks.map((l) => l.key));
      const deletedKeys = initialLandmarks
        .filter((l) => !currentLandmarkKeys.has(l.key))
        .map((l) => l.key);

      const routePoints = roads.flatMap((road) => road.points);

      const response = await fetch("/api/admin/map-layout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shops: { updated: updatedShops, deletedLocationIds },
          landmarks: { upsert: upsertLandmarks, deletedKeys },
          route: { points: routePoints, config: routeConfig },
          roads: roads.map(({ points: _points, ...road }) => road),
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "保存に失敗しました。");
        return;
      }

      const nextData = await fetchMapLayout();
      const nextShops = Array.isArray(nextData.shops) ? nextData.shops : [];
      const nextLandmarks = Array.isArray(nextData.landmarks) ? nextData.landmarks : [];
      const nextRoads = Array.isArray(nextData.roads) ? nextData.roads : [];
      setShops(nextShops);
      setLandmarks(nextLandmarks);
      setRoads(nextRoads);
      setInitialShops(cloneShops(nextShops));
      setInitialLandmarks(cloneLandmarks(nextLandmarks));
      setInitialRoads(cloneRoads(nextRoads));
      setPending([]);
      setMessage("保存しました。");
    } catch {
      setMessage("保存に失敗しました。通信環境を確認してください。");
    } finally {
      setIsSaving(false);
    }
  }, [shops, initialShops, landmarks, initialLandmarks, roads, routeConfig]);

  // ── スナップショット ──────────────────────────────────────────
  const loadSnapshots = useCallback(async () => {
    setIsLoadingSnapshots(true);
    try {
      const response = await fetch("/api/admin/map-layout/snapshots");
      if (!response.ok) return;
      const data = (await response.json()) as { snapshots?: SnapshotItem[] };
      setSnapshots(Array.isArray(data.snapshots) ? data.snapshots : []);
    } finally {
      setIsLoadingSnapshots(false);
    }
  }, []);

  useEffect(() => {
    if (isHistoryOpen) void loadSnapshots();
  }, [isHistoryOpen, loadSnapshots]);

  const handleRestoreSnapshot = useCallback(
    async (snapshotId: string) => {
      if (hasUnsavedChanges) {
        setMessage("未保存の変更があるため復元できません。先に保存するか変更を取り消してください。");
        return;
      }
      setIsRestoring(snapshotId);
      try {
        const response = await fetch("/api/admin/map-layout/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId }),
        });
        if (!response.ok) {
          setMessage("復元に失敗しました。");
          return;
        }
        const nextData = await fetchMapLayout();
        const nextShops = Array.isArray(nextData.shops) ? nextData.shops : [];
        const nextLandmarks = Array.isArray(nextData.landmarks) ? nextData.landmarks : [];
        const nextRoads = Array.isArray(nextData.roads) ? nextData.roads : [];
        setShops(nextShops);
        setLandmarks(nextLandmarks);
        setRoads(nextRoads);
        setInitialShops(cloneShops(nextShops));
        setInitialLandmarks(cloneLandmarks(nextLandmarks));
        setInitialRoads(cloneRoads(nextRoads));
        setPending([]);
        setMessage("スナップショットを復元しました。");
        await loadSnapshots();
      } finally {
        setIsRestoring(null);
      }
    },
    [hasUnsavedChanges, loadSnapshots]
  );

  return (
    <MapEditClientV3Body
      tab={tab}
      setTab={setTab}
      isLoading={isLoading}
      isSaving={isSaving}
      message={message}
      shops={shops}
      setShops={setShops}
      landmarks={landmarks}
      setLandmarks={setLandmarks}
      roads={roads}
      setRoads={setRoads}
      routeConfig={routeConfig}
      vendorOptions={vendorOptions}
      mapSettingsLimits={mapSettingsLimits}
      selectedLocationId={selectedLocationId}
      setSelectedLocationId={setSelectedLocationId}
      selectedRoadId={selectedRoadId}
      setSelectedRoadId={setSelectedRoadId}
      selectedLandmarkKey={selectedLandmarkKey}
      setSelectedLandmarkKey={setSelectedLandmarkKey}
      slotAction={slotAction}
      setSlotAction={setSlotAction}
      roadAction={roadAction}
      setRoadAction={setRoadAction}
      landmarkAction={landmarkAction}
      setLandmarkAction={setLandmarkAction}
      draft={draft}
      setDraft={setDraft}
      drawAxis={drawAxis}
      setDrawAxis={setDrawAxis}
      search={search}
      setSearch={setSearch}
      pending={pending}
      log={log}
      setPending={setPending}
      zoomIdx={zoomIdx}
      setZoomIdx={setZoomIdx}
      focus={focus}
      setFocus={setFocus}
      dragging={dragging}
      setDragging={setDragging}
      hasUnsavedChanges={hasUnsavedChanges}
      handleSave={handleSave}
      projection={projection}
      vertexDragRef={vertexDragRef}
      panRef={panRef}
      viewportRef={viewportRef}
      snapshots={snapshots}
      isLoadingSnapshots={isLoadingSnapshots}
      isRestoring={isRestoring}
      isHistoryOpen={isHistoryOpen}
      setIsHistoryOpen={setIsHistoryOpen}
      handleRestoreSnapshot={handleRestoreSnapshot}
    />
  );
}

// ─────────────────────────────────────────────────────────────
// Body: ヘッダー・キャンバス・サイドパネルの実際の描画とインタラクション
// ─────────────────────────────────────────────────────────────

type BodyProps = {
  tab: Tab;
  setTab: (tab: Tab) => void;
  isLoading: boolean;
  isSaving: boolean;
  message: string | null;
  shops: EditableShop[];
  setShops: React.Dispatch<React.SetStateAction<EditableShop[]>>;
  landmarks: EditableLandmark[];
  setLandmarks: React.Dispatch<React.SetStateAction<EditableLandmark[]>>;
  roads: EditableRoad[];
  setRoads: React.Dispatch<React.SetStateAction<EditableRoad[]>>;
  routeConfig: MapRouteConfig;
  vendorOptions: VendorOption[];
  mapSettingsLimits: MapSettingsLimits;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string | null) => void;
  selectedRoadId: string | null;
  setSelectedRoadId: (id: string | null) => void;
  selectedLandmarkKey: string | null;
  setSelectedLandmarkKey: (key: string | null) => void;
  slotAction: SlotAction;
  setSlotAction: React.Dispatch<React.SetStateAction<SlotAction>>;
  roadAction: RoadAction;
  setRoadAction: React.Dispatch<React.SetStateAction<RoadAction>>;
  landmarkAction: LandmarkAction;
  setLandmarkAction: React.Dispatch<React.SetStateAction<LandmarkAction>>;
  draft: { lat: number; lng: number }[];
  setDraft: React.Dispatch<React.SetStateAction<{ lat: number; lng: number }[]>>;
  drawAxis: "h" | "v" | "free";
  setDrawAxis: (axis: "h" | "v" | "free") => void;
  search: string;
  setSearch: (value: string) => void;
  pending: PendingChange[];
  log: (label: string, text: string, before?: PendingChangeSnapshot) => void;
  setPending: React.Dispatch<React.SetStateAction<PendingChange[]>>;
  zoomIdx: number;
  setZoomIdx: React.Dispatch<React.SetStateAction<number>>;
  focus: { x: number; y: number };
  setFocus: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  dragging: boolean;
  setDragging: (value: boolean) => void;
  hasUnsavedChanges: boolean;
  handleSave: () => Promise<void>;
  projection: ReturnType<typeof createProjection>;
  vertexDragRef: React.MutableRefObject<{ roadId: string; pointId: string } | null>;
  panRef: React.MutableRefObject<{ sx: number; sy: number; fx: number; fy: number } | null>;
  viewportRef: React.MutableRefObject<HTMLDivElement | null>;
  snapshots: SnapshotItem[];
  isLoadingSnapshots: boolean;
  isRestoring: string | null;
  isHistoryOpen: boolean;
  setIsHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleRestoreSnapshot: (id: string) => Promise<void>;
};

function MapEditClientV3Body(props: BodyProps) {
  const {
    tab, setTab, isLoading, isSaving, message,
    shops, setShops, landmarks, setLandmarks, roads, setRoads, routeConfig, vendorOptions, mapSettingsLimits,
    selectedLocationId, setSelectedLocationId, selectedRoadId, setSelectedRoadId,
    selectedLandmarkKey, setSelectedLandmarkKey,
    slotAction, setSlotAction, roadAction, setRoadAction, landmarkAction, setLandmarkAction,
    draft, setDraft, drawAxis, setDrawAxis,
    search, setSearch, pending, log, setPending,
    zoomIdx, setZoomIdx, focus, setFocus, dragging, setDragging,
    hasUnsavedChanges, handleSave, projection, vertexDragRef, panRef, viewportRef,
    snapshots, isLoadingSnapshots, isRestoring, isHistoryOpen, setIsHistoryOpen, handleRestoreSnapshot,
  } = props;

  const z = ZOOMS[zoomIdx];
  // 道の頂点ドラッグ開始時点のスナップショット（onVertexMoveEnd で「直前を取り消す」に使う）
  const vertexDragBeforeRef = useRef<PendingChangeSnapshot | null>(null);

  const selectedShop = useMemo(
    () => shops.find((s) => s.locationId === selectedLocationId) ?? null,
    [shops, selectedLocationId]
  );
  const selectedRoad = useMemo(
    () => roads.find((r) => r.id === selectedRoadId) ?? null,
    [roads, selectedRoadId]
  );
  const selectedLandmark = useMemo(
    () => landmarks.find((l) => l.key === selectedLandmarkKey) ?? null,
    [landmarks, selectedLandmarkKey]
  );

  const shopCounts = useMemo(() => {
    const occupied = shops.filter((s) => s.vendorId).length;
    return { occupied, vacant: shops.length - occupied };
  }, [shops]);

  // ── 区画: 道への投影で最寄りの道を求める ──────────────────────────────
  // サーバー側（app/api/admin/map-layout/_shared.ts）と同じ判定ロジックを使うため、
  // 共通実装（mapRouteGeometry.ts）をそのまま呼ぶ（別々に実装すると、保存時に
  // サーバーが検証する道の割り当てとエディタの表示がズレる恐れがあるため）
  const findNearestRoadId = useCallback(
    (point: { lat: number; lng: number }): string | null =>
      findNearestRoadIdShared(point, roads, routeConfig.snapDistanceMeters),
    [roads, routeConfig.snapDistanceMeters]
  );

  // 道を新規作成中、既存の道の点の近くをクリックしたらその点にぴったり
  // つなげられるようにする（道同士が交差・合流する見た目を作れるようにするため）
  const findNearestRoutePoint = useCallback(
    (point: { lat: number; lng: number }): MapRoutePoint | null => {
      let nearest: MapRoutePoint | null = null;
      let bestDistance = Infinity;
      for (const road of roads) {
        for (const p of road.points) {
          const d = distanceMeters(point, p);
          if (d < bestDistance) {
            bestDistance = d;
            nearest = p;
          }
        }
      }
      return bestDistance <= POINT_SNAP_DISTANCE_METERS ? nearest : null;
    },
    [roads]
  );

  // 区画レーン（下部の一覧）の並び順。レーン表示とキーボード/WASDナビゲーションの
  // 両方がこの同じ並び順を参照する（表示と操作の向きが食い違わないようにするため）
  const laneGroups: LaneRoadGroup[] = useMemo(
    () => buildLaneRoadGroups(shops, roads, findNearestRoadId, projection),
    [shops, roads, findNearestRoadId, projection]
  );

  // ── 区画選択・移動・登録 ──────────────────────────────
  const selectShop = useCallback(
    (locationId: string) => {
      const shop = shops.find((s) => s.locationId === locationId);
      if (!shop) return;

      if (slotAction === "move" && selectedLocationId && locationId !== selectedLocationId) {
        const from = shops.find((s) => s.locationId === selectedLocationId);
        if (!from || !from.vendorId || shop.vendorId) {
          setSlotAction("idle");
          setSelectedLocationId(locationId);
          return;
        }
        const fromName = from.name;
        const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
        setShops((prev) =>
          prev.map((s) => {
            if (s.locationId === from.locationId) return { ...s, vendorId: undefined, name: `未設定店舗 ${s.position}` };
            if (s.locationId === locationId) return { ...s, vendorId: from.vendorId, name: fromName };
            return s;
          })
        );
        log(String(shop.position), `${fromName} を ${from.position} から移動`, before);
        setSlotAction("idle");
        setSelectedLocationId(locationId);
        return;
      }

      if (slotAction === "place") {
        if (shop.vendorId) {
          setSelectedLocationId(locationId);
          return;
        }
        setSlotAction("idle");
        setSelectedLocationId(locationId);
        return;
      }

      setSelectedLocationId(locationId);
    },
    [shops, roads, landmarks, slotAction, selectedLocationId, setShops, setSlotAction, setSelectedLocationId, log]
  );

  // 下部の区画レーンで店舗名をタップした時は、選択に加えて地図側もその区画の
  // 位置へ移動する（キーボード/WASDでの移動時と同じ挙動に揃える）
  const selectShopFromLane = useCallback(
    (locationId: string) => {
      selectShop(locationId);
      const shop = shops.find((s) => s.locationId === locationId);
      if (shop) setFocus(projection.toLocal(shop.lat, shop.lng));
    },
    [selectShop, shops, projection, setFocus]
  );

  const setVendorName = useCallback(
    (value: string) => {
      if (!selectedShop) return;
      setShops((prev) =>
        prev.map((s) => (s.locationId === selectedShop.locationId ? { ...s, vendorId: s.vendorId ?? "manual", name: value } : s))
      );
    },
    [selectedShop, setShops]
  );

  const handleVendorSelect = useCallback(
    (vendorId: string) => {
      if (!selectedShop) return;
      const vendor = vendorOptions.find((v) => v.id === vendorId);
      const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
      setShops((prev) =>
        prev.map((s) =>
          s.locationId === selectedShop.locationId
            ? { ...s, vendorId: vendorId || undefined, name: vendor?.name ?? `未設定店舗 ${s.position}` }
            : s
        )
      );
      log(String(selectedShop.position), vendor ? `${vendor.name} を割り当て` : "空きに変更", before);
    },
    [selectedShop, vendorOptions, shops, roads, landmarks, setShops, log]
  );

  const clearVendor = useCallback(() => {
    if (!selectedShop) return;
    const name = selectedShop.name;
    const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
    setShops((prev) =>
      prev.map((s) => (s.locationId === selectedShop.locationId ? { ...s, vendorId: undefined, name: `未設定店舗 ${s.position}` } : s))
    );
    log(String(selectedShop.position), `${name} を空きに変更`, before);
  }, [selectedShop, shops, roads, landmarks, setShops, log]);

  const startMove = useCallback(() => setSlotAction("move"), [setSlotAction]);
  const startPlace = useCallback(() => setSlotAction((prev) => (prev === "place" ? "idle" : "place")), [setSlotAction]);

  const addSlotsToRoad = useCallback(
    (road: EditableRoad, count: number) => {
      const currentUnassignedCount = shops.filter((s) => !s.vendorId).length;
      if (currentUnassignedCount + count > mapSettingsLimits.maxUnassignedShopMarkers) {
        log("道", `未割当マーカは最大 ${mapSettingsLimits.maxUnassignedShopMarkers} 件までです`);
        return;
      }
      const existingOnRoad = shops.filter((s) => findNearestRoadId({ lat: s.lat, lng: s.lng }) === road.id);
      const nextPosition = shops.reduce((max, s) => Math.max(max, s.position), 0) + 1;
      const pairs = Math.max(1, Math.ceil((existingOnRoad.length + count) / 2));
      const newShops: EditableShop[] = [];
      for (let i = 0; i < count; i += 1) {
        const index = existingOnRoad.length + i;
        const t = (Math.floor(index / 2) + 0.5) / pairs;
        const north = index % 2 === 0;
        const at = pointAtT(road.points, t);
        const halfWidth = road.widthMeters / 2 + 3;
        const offset = offsetLatLng(at, at.nx, at.ny, north ? halfWidth : -halfWidth);
        newShops.push({
          locationId: `new-${Date.now()}-${index}`,
          id: nextPosition + i,
          position: nextPosition + i,
          name: `未設定店舗 ${nextPosition + i}`,
          lat: offset.lat,
          lng: offset.lng,
        });
      }
      const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
      setShops((prev) => [...prev, ...newShops]);
      log("道", `${road.name} に ${count} 区画を追加`, before);
    },
    [shops, roads, landmarks, findNearestRoadId, setShops, log, mapSettingsLimits.maxUnassignedShopMarkers]
  );

  // ── 道: 選択・編集 ──────────────────────────────
  const selectRoad = useCallback(
    (roadId: string) => {
      setSelectedRoadId(roadId);
      setRoadAction("idle");
    },
    [setSelectedRoadId, setRoadAction]
  );

  const patchRoad = useCallback(
    (roadId: string, patch: Partial<EditableRoad>, logText?: string) => {
      const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
      setRoads((prev) => prev.map((r) => (r.id === roadId ? { ...r, ...patch } : r)));
      if (logText) {
        const road = roads.find((r) => r.id === roadId);
        if (road) log("道", `${road.name} ${logText}`, before);
      }
    },
    [shops, roads, landmarks, setRoads, log]
  );

  const deleteRoad = useCallback(() => {
    if (!selectedRoad) return;
    const hasShop = shops.some((s) => findNearestRoadId({ lat: s.lat, lng: s.lng }) === selectedRoad.id);
    if (hasShop) {
      log("道", `${selectedRoad.name} には区画があるため削除できません`);
      return;
    }
    const name = selectedRoad.name;
    const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
    setRoads((prev) => prev.filter((r) => r.id !== selectedRoad.id));
    setSelectedRoadId(null);
    setRoadAction("idle");
    log("道", `${name} を削除`, before);
  }, [selectedRoad, shops, roads, landmarks, findNearestRoadId, setRoads, setSelectedRoadId, setRoadAction, log]);

  const finishDraw = useCallback(() => {
    if (draft.length < 2) return;
    const id = `r${Date.now()}`;
    const name = `新しい道 ${roads.length + 1}`;
    const points: MapRoutePoint[] = draft.map((p, index) => ({
      id: `${id}-p${index}`,
      lat: p.lat,
      lng: p.lng,
      order: index,
      roadId: id,
    }));
    const newRoad: EditableRoad = { id, name, kind: "street", widthMeters: ROAD_KIND_DEFAULT_WIDTH.street, points };
    const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
    setRoads((prev) => [...prev, newRoad]);
    setDraft([]);
    setRoadAction("idle");
    setSelectedRoadId(id);
    log("道", `${name} を追加（頂点${points.length}）`, before);
  }, [draft, roads, shops, landmarks, setRoads, setDraft, setRoadAction, setSelectedRoadId, log]);

  const cancelMode = useCallback(() => {
    setSlotAction("idle");
    setRoadAction("idle");
    setLandmarkAction("idle");
    setDraft([]);
  }, [setSlotAction, setRoadAction, setLandmarkAction, setDraft]);

  // ── 建物 ──────────────────────────────
  const selectLandmark = useCallback(
    (key: string) => {
      setSelectedLandmarkKey(key);
    },
    [setSelectedLandmarkKey]
  );

  const patchLandmark = useCallback(
    (key: string, patch: Partial<EditableLandmark>) => {
      setLandmarks((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    },
    [setLandmarks]
  );

  const deleteLandmark = useCallback(() => {
    if (!selectedLandmark) return;
    const name = selectedLandmark.name;
    const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
    setLandmarks((prev) => prev.filter((l) => l.key !== selectedLandmark.key));
    setSelectedLandmarkKey(null);
    log("建物", `${name} を削除`, before);
  }, [selectedLandmark, shops, roads, landmarks, setLandmarks, setSelectedLandmarkKey, log]);

  const addLandmark = useCallback(
    (lat: number, lng: number) => {
      if (landmarks.length >= mapSettingsLimits.maxLandmarks) {
        log("建物", `建物オブジェクトは最大 ${mapSettingsLimits.maxLandmarks} 件までです`);
        return;
      }
      const key = `landmark-${Date.now()}`;
      const newLandmark: EditableLandmark = {
        key,
        name: "新しい建物",
        description: "",
        url: "/images/maps/elements/buildings/KochiCastle.png",
        lat,
        lng,
        widthPx: 120,
        heightPx: 80,
        showAtMinZoom: false,
      };
      const before: PendingChangeSnapshot = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
      setLandmarks((prev) => [...prev, newLandmark]);
      setSelectedLandmarkKey(key);
      setLandmarkAction("idle");
      log("建物", "新しい建物を追加", before);
    },
    [shops, roads, landmarks, setLandmarks, setSelectedLandmarkKey, setLandmarkAction, log, mapSettingsLimits.maxLandmarks]
  );

  // ── キーボード（矢印キー / WASD で区画レーンと同じ並び順に沿って移動） ──────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelMode();
        return;
      }
      if (tab !== "slot" || !selectedShop) return;

      const lower = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const isLeft = e.key === "ArrowLeft" || lower === "a";
      const isRight = e.key === "ArrowRight" || lower === "d";
      const isUp = e.key === "ArrowUp" || lower === "w";
      const isDown = e.key === "ArrowDown" || lower === "s";
      if (!isLeft && !isRight && !isUp && !isDown) return;

      // レーン表示（road → 丁目 → 北側/南側の対カラム）を左から右へ1列に平らにし、
      // 表示と全く同じ並び順で移動先を探す（店番の大小に依存すると、実際の並びと
      // 逆方向に動くことがあるため位置番号の算術には頼らない）
      const columns: { north?: EditableShop; south?: EditableShop }[] = [];
      for (const { sections } of laneGroups) {
        for (const section of sections) {
          for (let i = 0; i < section.columns; i += 1) {
            columns.push({ north: section.north[i]?.shop, south: section.south[i]?.shop });
          }
        }
      }

      const currentIndex = columns.findIndex(
        (col) => col.north?.locationId === selectedShop.locationId || col.south?.locationId === selectedShop.locationId
      );
      if (currentIndex === -1) return;
      const currentSide: "north" | "south" = columns[currentIndex].north?.locationId === selectedShop.locationId ? "north" : "south";

      let targetIndex = currentIndex;
      let targetSide = currentSide;
      if (isRight) {
        let i = currentIndex + 1;
        while (i < columns.length && !columns[i][currentSide]) i += 1;
        if (i < columns.length) targetIndex = i;
      } else if (isLeft) {
        let i = currentIndex - 1;
        while (i >= 0 && !columns[i][currentSide]) i -= 1;
        if (i >= 0) targetIndex = i;
      } else if (isUp) {
        targetSide = "north";
      } else if (isDown) {
        targetSide = "south";
      }

      const target = columns[targetIndex]?.[targetSide];
      if (target) {
        e.preventDefault();
        setSelectedLocationId(target.locationId);
        setFocus(projection.toLocal(target.lat, target.lng));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, selectedShop, laneGroups, projection, cancelMode, setSelectedLocationId, setFocus]);

  const undo = useCallback(() => {
    setPending((prev) => {
      const [latest, ...rest] = prev;
      if (!latest) return prev;
      if (latest.before) {
        setShops(latest.before.shops);
        setRoads(latest.before.roads);
        setLandmarks(latest.before.landmarks);
      }
      return rest;
    });
  }, [setPending, setShops, setRoads, setLandmarks]);

  const canvasHandlers: CanvasHandlers = {
    onSelectShop: selectShop,
    onSelectRoad: selectRoad,
    onSelectLandmark: selectLandmark,
    onMoveLandmark: (key, lat, lng) => patchLandmark(key, { lat, lng }),
    // 地図の空白部分クリック時の挙動は、現在のタブ・アクションによって変わる
    // （道編集モードなら道の頂点を追加、建物配置モードなら建物を新規配置）
    onMapClick: (lat, lng) => {
      if (tab === "road" && roadAction === "draw") {
        // 既存の道の点の近くをクリックした場合は、座標をその点にぴったり合わせて
        // つなげる（軸ロックより優先し、明示的な接続の意図をそのまま反映する）
        const snapped = findNearestRoutePoint({ lat, lng });
        setDraft((prev) => {
          const first = prev[0];
          let nextLat = snapped ? snapped.lat : lat;
          let nextLng = snapped ? snapped.lng : lng;
          if (!snapped && first && drawAxis === "h") nextLat = first.lat;
          if (!snapped && first && drawAxis === "v") nextLng = first.lng;
          return [...prev, { lat: nextLat, lng: nextLng }];
        });
        return;
      }
      if (tab === "landmark" && landmarkAction === "place") {
        addLandmark(lat, lng);
      }
    },
    onVertexMove: (roadId, pointId, lat, lng) => {
      if (!vertexDragBeforeRef.current) {
        vertexDragBeforeRef.current = { shops: cloneShops(shops), roads: cloneRoads(roads), landmarks: cloneLandmarks(landmarks) };
      }
      setRoads((prev) =>
        prev.map((r) =>
          r.id === roadId
            ? { ...r, points: r.points.map((p) => (p.id === pointId ? { ...p, lat, lng } : p)) }
            : r
        )
      );
    },
    onVertexMoveEnd: (roadId) => {
      const road = roads.find((r) => r.id === roadId);
      const before = vertexDragBeforeRef.current ?? undefined;
      vertexDragBeforeRef.current = null;
      if (road) log("道", `${road.name} の形を変更`, before);
    },
    onVertexRemove: (roadId, pointId) => {
      setRoads((prev) =>
        prev.map((r) =>
          r.id === roadId && r.points.length > 2
            ? { ...r, points: r.points.filter((p) => p.id !== pointId) }
            : r
        )
      );
    },
    onMidpointInsert: (roadId, afterIndex, lat, lng) => {
      const road = roads.find((r) => r.id === roadId);
      if (!road) return;
      const newPoint: MapRoutePoint = {
        id: `${roadId}-p${Date.now()}`,
        lat,
        lng,
        order: afterIndex + 1,
        roadId,
      };
      setRoads((prev) =>
        prev.map((r) =>
          r.id === roadId
            ? { ...r, points: [...r.points.slice(0, afterIndex + 1), newPoint, ...r.points.slice(afterIndex + 1)] }
            : r
        )
      );
    },
    onPan: (dx, dy) => setFocus((prev) => ({ x: prev.x + dx, y: prev.y + dy })),
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        background: "#FBF7EE",
        color: "#33302B",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 20px",
          background: "#fff",
          borderBottom: "1px solid #EDE3CD",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 17, fontWeight: 900 }}>マップ編集</span>
        </div>

        <div style={{ display: "flex", border: "1px solid #E4D9BF", borderRadius: 11, overflow: "hidden", flexShrink: 0 }}>
          {(["slot", "road", "landmark"] as Tab[]).map((t) => (
            <span
              key={t}
              onClick={() => {
                setTab(t);
                cancelMode();
              }}
              style={{
                padding: "8px 14px",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                background: tab === t ? "#92400E" : "#fff",
                color: tab === t ? "#fff" : "#57503F",
                whiteSpace: "nowrap",
              }}
            >
              {t === "slot" ? "区画を編集" : t === "road" ? "道を編集" : "建物を編集"}
            </span>
          ))}
        </div>

        <div style={{ position: "relative", flex: 1, maxWidth: 360, minWidth: 150 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "road" ? "道の名称で検索" : tab === "landmark" ? "建物の名称で検索" : "区画番号・出店者名で検索"
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "9px 13px",
              borderRadius: 11,
              border: "1px solid #E4D9BF",
              background: "#FDFBF5",
              fontSize: 13,
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#7A7264" }}>
            <span>
              <b style={{ fontSize: 13.5, color: "#33302B" }}>{shopCounts.occupied}</b> 出店
            </span>
            <span>
              <b style={{ fontSize: 13.5, color: "#33302B" }}>{shopCounts.vacant}</b> 空き
            </span>
            <span>
              <b style={{ fontSize: 13.5, color: "#33302B" }}>{roads.length}</b> 道
            </span>
          </div>
          <span
            onClick={() => setIsHistoryOpen((v) => !v)}
            style={{
              padding: "8px 13px",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: "#fff",
              color: "#57503F",
              border: "1px solid #E7DDC4",
            }}
          >
            変更履歴
          </span>
          <span
            onClick={() => void handleSave()}
            style={{
              padding: "9px 17px",
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 700,
              cursor: hasUnsavedChanges && !isSaving ? "pointer" : "default",
              background: hasUnsavedChanges ? "#F59E0B" : "#F3E7CC",
              color: hasUnsavedChanges ? "#fff" : "#A8996F",
            }}
          >
            {isSaving ? "保存中..." : hasUnsavedChanges ? `変更を保存（${pending.length}）` : "保存済み"}
          </span>
        </div>
      </header>

      {message && (
        <div style={{ padding: "8px 20px", background: "#FFF7E6", color: "#92400E", fontSize: 12.5, borderBottom: "1px solid #EDE3CD" }}>
          {message}
        </div>
      )}

      {(slotAction !== "idle" || roadAction !== "idle") && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 20px",
            background: "#92400E",
            color: "#fff",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {slotAction === "move"
              ? "移動先の空き区画をクリックしてください"
              : slotAction === "place"
                ? "新規出店者を置く空き区画をクリックしてください"
                : roadAction === "shape"
                  ? "頂点をドラッグで移動・線分クリックで頂点追加・ダブルクリックで削除"
                  : `地図をクリックして道を伸ばしてください（${drawAxis === "h" ? "横向き" : drawAxis === "v" ? "縦向き" : "自由"}・既存の点の近くをクリックするとそこに接続します）`}
          </span>
          {roadAction === "draw" && (
            <div style={{ display: "flex", gap: 5 }}>
              {(["h", "v", "free"] as const).map((axis) => (
                <span
                  key={axis}
                  onClick={() => setDrawAxis(axis)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: drawAxis === axis ? "#fff" : "rgba(255,255,255,.16)",
                    color: drawAxis === axis ? "#92400E" : "#fff",
                  }}
                >
                  {axis === "h" ? "横向き" : axis === "v" ? "縦向き" : "自由"}
                </span>
              ))}
            </div>
          )}
          {roadAction === "draw" && draft.length >= 2 && (
            <span
              onClick={finishDraw}
              style={{ fontSize: 12.5, fontWeight: 700, background: "#fff", color: "#92400E", borderRadius: 9, padding: "5px 12px", cursor: "pointer" }}
            >
              この形で確定
            </span>
          )}
          <span
            onClick={cancelMode}
            style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, border: "1px solid rgba(255,255,255,.5)", borderRadius: 9, padding: "5px 11px", cursor: "pointer" }}
          >
            キャンセル (Esc)
          </span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <MapEditCanvas
            tab={tab}
            shops={shops}
            roads={roads}
            landmarks={landmarks}
            selectedLocationId={selectedLocationId}
            selectedRoadId={selectedRoadId}
            selectedLandmarkKey={selectedLandmarkKey}
            slotAction={slotAction}
            roadAction={roadAction}
            landmarkAction={landmarkAction}
            draft={draft}
            search={search}
            zoom={z}
            zoomIdx={zoomIdx}
            focus={focus}
            setFocus={setFocus}
            dragging={dragging}
            setDragging={setDragging}
            projection={projection}
            handlers={canvasHandlers}
            viewportRef={viewportRef}
            panRef={panRef}
            vertexDragRef={vertexDragRef}
            isLoading={isLoading}
            onZoomIn={() => setZoomIdx((prev) => Math.min(MAX_ZOOM_IDX, prev + 1))}
            onZoomOut={() => setZoomIdx((prev) => Math.max(0, prev - 1))}
          />
          {tab === "slot" && (
            <RoadLaneView
              groups={laneGroups}
              selectedLocationId={selectedLocationId}
              slotAction={slotAction}
              search={search}
              onSelectShop={selectShopFromLane}
            />
          )}
        </div>

        <aside
          style={{
            width: 320,
            flexShrink: 0,
            minHeight: 0,
            background: "#fff",
            borderLeft: "1px solid #EDE3CD",
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {isHistoryOpen ? (
            <div style={{ padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 900 }}>変更履歴（スナップショット）</span>
                <span onClick={() => setIsHistoryOpen(false)} style={{ cursor: "pointer", fontSize: 12, color: "#9A8A6A" }}>
                  閉じる
                </span>
              </div>
              {isLoadingSnapshots ? (
                <p style={{ fontSize: 12, color: "#9A8A6A" }}>読み込み中...</p>
              ) : snapshots.length === 0 ? (
                <p style={{ fontSize: 12, color: "#9A8A6A" }}>スナップショットはまだありません。</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {snapshots.map((snap) => (
                    <div key={snap.id} style={{ border: "1px solid #F3EBD8", borderRadius: 10, padding: 10 }}>
                      <p style={{ margin: 0, fontSize: 11.5, color: "#9A8A6A" }}>
                        {new Date(snap.created_at).toLocaleString("ja-JP")}
                      </p>
                      <span
                        onClick={() => void handleRestoreSnapshot(snap.id)}
                        style={{
                          marginTop: 6,
                          display: "inline-block",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#92400E",
                          cursor: hasUnsavedChanges || isRestoring ? "default" : "pointer",
                          opacity: hasUnsavedChanges || isRestoring ? 0.4 : 1,
                        }}
                      >
                        {isRestoring === snap.id ? "復元中..." : "この状態に復元"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {tab === "slot" && (
                <SlotDetailPanel
                  shop={selectedShop}
                  vendorOptions={vendorOptions}
                  onVendorNameChange={setVendorName}
                  onVendorSelect={handleVendorSelect}
                  onStartMove={startMove}
                  onClearVendor={clearVendor}
                />
              )}
              {tab === "road" && (
                <RoadDetailPanel
                  road={selectedRoad}
                  roads={roads}
                  search={search}
                  roadAction={roadAction}
                  onSelectRoad={selectRoad}
                  onNameChange={(value) => selectedRoad && patchRoad(selectedRoad.id, { name: value })}
                  onKindChange={(kind: RoadKind) =>
                    selectedRoad && patchRoad(selectedRoad.id, { kind, widthMeters: ROAD_KIND_DEFAULT_WIDTH[kind] }, `を${ROAD_KIND_LABELS[kind]}に変更`)
                  }
                  onWiderClick={() => selectedRoad && patchRoad(selectedRoad.id, { widthMeters: Math.min(90, selectedRoad.widthMeters + 4) }, "の道幅を変更")}
                  onNarrowerClick={() => selectedRoad && patchRoad(selectedRoad.id, { widthMeters: Math.max(8, selectedRoad.widthMeters - 4) }, "の道幅を変更")}
                  onToggleShape={() => setRoadAction((prev) => (prev === "shape" ? "idle" : "shape"))}
                  onDelete={deleteRoad}
                  onAddSlots={(count) => selectedRoad && addSlotsToRoad(selectedRoad, count)}
                  shopCountOnRoad={(roadId) => shops.filter((s) => findNearestRoadId({ lat: s.lat, lng: s.lng }) === roadId).length}
                />
              )}
              {tab === "landmark" && (
                <LandmarkDetailPanel
                  landmark={selectedLandmark}
                  onNameChange={(value) => selectedLandmark && patchLandmark(selectedLandmark.key, { name: value })}
                  onDescriptionChange={(value) => selectedLandmark && patchLandmark(selectedLandmark.key, { description: value })}
                  onDelete={deleteLandmark}
                />
              )}

              <PendingChangeLog pending={pending} onUndo={undo} />
            </>
          )}
        </aside>
      </div>

      {tab === "road" && !isHistoryOpen && (
        <div style={{ flexShrink: 0, padding: "10px 20px", background: "#fff", borderTop: "1px solid #EDE3CD" }}>
          <span
            onClick={() => setRoadAction((prev) => (prev === "draw" ? "idle" : "draw"))}
            style={{
              padding: "8px 13px",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: roadAction === "draw" ? "#92400E" : "#FFF7E6",
              color: roadAction === "draw" ? "#fff" : "#92400E",
              border: "1px solid #E0B877",
            }}
          >
            {roadAction === "draw" ? "通り道を指定中…" : "＋ 道を追加"}
          </span>
        </div>
      )}
      {tab === "landmark" && !isHistoryOpen && (
        <div style={{ flexShrink: 0, padding: "10px 20px", background: "#fff", borderTop: "1px solid #EDE3CD" }}>
          <span
            onClick={() => setLandmarkAction((prev) => (prev === "place" ? "idle" : "place"))}
            style={{
              padding: "8px 13px",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: landmarkAction === "place" ? "#92400E" : "#FFF7E6",
              color: landmarkAction === "place" ? "#fff" : "#92400E",
              border: "1px solid #E0B877",
            }}
          >
            {landmarkAction === "place" ? "地図をクリックして配置…" : "＋ 建物を追加"}
          </span>
        </div>
      )}
      {tab === "slot" && !isHistoryOpen && (
        <div style={{ flexShrink: 0, padding: "10px 20px", background: "#fff", borderTop: "1px solid #EDE3CD" }}>
          <span
            onClick={startPlace}
            style={{
              padding: "8px 13px",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: "pointer",
              background: slotAction === "place" ? "#92400E" : "#FFF7E6",
              color: slotAction === "place" ? "#fff" : "#92400E",
              border: "1px solid #E0B877",
            }}
          >
            {slotAction === "place" ? "登録先を選択中…" : "＋ 新規出店者"}
          </span>
        </div>
      )}
    </div>
  );
}
