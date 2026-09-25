"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  distanceMeters,
  findNearestRoadId as findNearestRoadIdShared,
  getRouteCenter,
} from "../../map/utils/mapRouteGeometry";
import type { MapRouteConfig, MapRoutePoint, RoadKind } from "../../map/types/mapRoute";
import { createProjection } from "./geo";
import { pointAtT, offsetLatLng } from "./roadPlacement";
import {
  ROAD_KIND_DEFAULT_WIDTH,
  ROAD_KIND_LABELS,
  type CanvasHandlers,
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
import { useMapEditData, type MapSettingsLimits } from "./useMapEditData";
import MapEditCanvasMapLibre from "./components/MapEditCanvasMapLibre";
import { MapEditHeader } from "./components/MapEditHeader";
import { MapEditModeBanner } from "./components/MapEditModeBanner";
import { SnapshotHistoryPanel } from "./components/SnapshotHistoryPanel";
import { SlotDetailPanel, RoadDetailPanel, LandmarkDetailPanel } from "./components/DetailPanels";
import PendingChangeLog from "./components/PendingChangeLog";
import RoadLaneView, { buildLaneRoadGroups, type LaneRoadGroup } from "./components/RoadLaneView";

const MAX_ZOOM_IDX = 2;
// 道を描いている途中、既存の点からこの距離（メートル）以内をクリックしたら
// その点にスナップして接続する
const POINT_SNAP_DISTANCE_METERS = 6;

// 公開マップ側（RoadOverlay.tsx / mapRouteDb.ts）が road_id・複数道の概念にまだ
// 未対応で、単一のグローバルroadHalfWidthMetersで全道路を描画している。
// この状態で新しい道（kind: "street" など）を追加保存すると、公開マップ上で
// 無関係な道同士が1本の道として繋がって描画されてしまう恐れがあるため、
// 公開マップ側の複数道対応が入るまで、新規の道の作成は一時的に無効化する
// （既存の道の編集・削除は対象外）
const isRoadCreationDisabled = true;

function cloneShops(shops: EditableShop[]) {
  return shops.map((shop) => ({ ...shop }));
}
function cloneLandmarks(landmarks: EditableLandmark[]) {
  return landmarks.map((landmark) => ({ ...landmark }));
}
function cloneRoads(roads: EditableRoad[]) {
  return roads.map((road) => ({ ...road, points: road.points.map((p) => ({ ...p })) }));
}

let pendingIdCounter = 0;

export default function MapEditClientV3() {
  const [tab, setTab] = useState<Tab>("slot");

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
  const [rotation, setRotation] = useState(0);

  const log = useCallback((label: string, text: string, before?: PendingChangeSnapshot) => {
    pendingIdCounter += 1;
    setPending((prev) => [{ id: pendingIdCounter, label, text, before }, ...prev]);
  }, []);

  const data = useMapEditData({
    onLoaded: () => setFocus({ x: 0, y: 0 }),
    clearPending: () => setPending([]),
  });

  return (
    <MapEditClientV3Body
      tab={tab}
      setTab={setTab}
      isLoading={data.isLoading}
      isSaving={data.isSaving}
      message={data.message}
      shops={data.shops}
      setShops={data.setShops}
      landmarks={data.landmarks}
      setLandmarks={data.setLandmarks}
      roads={data.roads}
      setRoads={data.setRoads}
      routeConfig={data.routeConfig}
      vendorOptions={data.vendorOptions}
      mapSettingsLimits={data.mapSettingsLimits}
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
      rotation={rotation}
      setRotation={setRotation}
      hasUnsavedChanges={data.hasUnsavedChanges}
      handleSave={data.handleSave}
      projection={data.projection}
      snapshots={data.snapshots}
      isLoadingSnapshots={data.isLoadingSnapshots}
      isRestoring={data.isRestoring}
      isHistoryOpen={data.isHistoryOpen}
      setIsHistoryOpen={data.setIsHistoryOpen}
      handleRestoreSnapshot={data.handleRestoreSnapshot}
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
  rotation: number;
  setRotation: React.Dispatch<React.SetStateAction<number>>;
  hasUnsavedChanges: boolean;
  handleSave: () => Promise<void>;
  projection: ReturnType<typeof createProjection>;
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
    zoomIdx, setZoomIdx, focus, setFocus, rotation, setRotation,
    hasUnsavedChanges, handleSave, projection,
    snapshots, isLoadingSnapshots, isRestoring, isHistoryOpen, setIsHistoryOpen, handleRestoreSnapshot,
  } = props;

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

  // 道の一覧で名前をタップした時は、区画レーンでの店舗タップと同じく
  // 選択に加えて地図側もその道の位置へ移動する
  const selectRoadFromList = useCallback(
    (roadId: string) => {
      selectRoad(roadId);
      const road = roads.find((r) => r.id === roadId);
      if (road && road.points.length > 0) {
        const center = getRouteCenter(road.points);
        setFocus(projection.toLocal(center[0], center[1]));
      }
    },
    [selectRoad, roads, projection, setFocus]
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

  const finishDraw = useCallback(
    (pointsOverride?: { lat: number; lng: number }[]) => {
      const draftPoints = pointsOverride ?? draft;
      if (draftPoints.length < 2) return;
      const id = `r${Date.now()}`;
      const name = `新しい道 ${roads.length + 1}`;
      const points: MapRoutePoint[] = draftPoints.map((p, index) => ({
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
    },
    [draft, roads, shops, landmarks, setRoads, setDraft, setRoadAction, setSelectedRoadId, log]
  );

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

      // 検索ボックスなど入力欄にフォーカスがある間は、WASD/矢印キーをナビゲーションとして
      // 横取りしない（例: 「わらび餅」のようにw/a/s/dを含む名前を検索しようとした際に
      // 文字入力が握りつぶされて区画移動してしまうのを防ぐ）
      const eventTarget = e.target;
      const isFormField =
        eventTarget instanceof HTMLElement &&
        (eventTarget.tagName === "INPUT" ||
          eventTarget.tagName === "TEXTAREA" ||
          eventTarget.tagName === "SELECT" ||
          eventTarget.isContentEditable);
      if (isFormField) return;

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

      if (currentIndex === -1) {
        // market種別の道に紐づくレーンに含まれない区画（他種別の道が最寄りだったり、
        // どの道からも離れすぎている場合）は、旧実装と同じ店番の前後関係で移動する
        // フォールバックを使う（レーンに存在しないせいで一切動かせなくなるのを防ぐ）
        const n = selectedShop.position;
        let nextPos: number | null = null;
        if (isRight) nextPos = n + 2;
        else if (isLeft) nextPos = n - 2;
        else if (isUp || isDown) nextPos = n % 2 === 1 ? n + 1 : n - 1;
        if (nextPos != null) {
          const fallbackTarget = shops.find((s) => s.position === nextPos);
          if (fallbackTarget) {
            e.preventDefault();
            setSelectedLocationId(fallbackTarget.locationId);
            setFocus(projection.toLocal(fallbackTarget.lat, fallbackTarget.lng));
          }
        }
        return;
      }

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
  }, [tab, selectedShop, shops, laneGroups, projection, cancelMode, setSelectedLocationId, setFocus]);

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
        const nextLat = snapped ? snapped.lat : lat;
        const nextLng = snapped ? snapped.lng : lng;

        // すでに新しい点を打ってある状態で既存の点をクリックしたら、
        // 「新たな点を打って、つなげたい点をクリックでつながる」という操作イメージの通り、
        // その場でつなげて道を確定する（「この形で確定」を別途押す必要がない）
        if (snapped && draft.length >= 1) {
          finishDraw([...draft, { lat: nextLat, lng: nextLng }]);
          return;
        }

        setDraft((prev) => {
          const first = prev[0];
          let pointLat = nextLat;
          let pointLng = nextLng;
          if (!snapped && first && drawAxis === "h") pointLat = first.lat;
          if (!snapped && first && drawAxis === "v") pointLng = first.lng;
          return [...prev, { lat: pointLat, lng: pointLng }];
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
      <MapEditHeader
        tab={tab}
        onTabChange={(t) => {
          setTab(t);
          cancelMode();
        }}
        search={search}
        onSearchChange={setSearch}
        occupiedCount={shopCounts.occupied}
        vacantCount={shopCounts.vacant}
        roadCount={roads.length}
        onToggleHistory={() => setIsHistoryOpen((v) => !v)}
        hasUnsavedChanges={hasUnsavedChanges}
        isSaving={isSaving}
        pendingCount={pending.length}
        onSave={() => void handleSave()}
      />

      {message && (
        <div style={{ padding: "8px 20px", background: "#FFF7E6", color: "#92400E", fontSize: 12.5, borderBottom: "1px solid #EDE3CD" }}>
          {message}
        </div>
      )}

      <MapEditModeBanner
        slotAction={slotAction}
        roadAction={roadAction}
        drawAxis={drawAxis}
        onDrawAxisChange={setDrawAxis}
        draftLength={draft.length}
        onFinishDraw={() => finishDraw()}
        onCancel={cancelMode}
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <MapEditCanvasMapLibre
            tab={tab}
            shops={shops}
            roads={roads}
            landmarks={landmarks}
            selectedLocationId={selectedLocationId}
            selectedRoadId={selectedRoadId}
            selectedLandmarkKey={selectedLandmarkKey}
            slotAction={slotAction}
            roadAction={roadAction}
            draft={draft}
            search={search}
            zoomIdx={zoomIdx}
            setZoomIdx={setZoomIdx}
            focus={focus}
            setFocus={setFocus}
            rotation={rotation}
            setRotation={setRotation}
            projection={projection}
            handlers={canvasHandlers}
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
            <SnapshotHistoryPanel
              snapshots={snapshots}
              isLoadingSnapshots={isLoadingSnapshots}
              isRestoring={isRestoring}
              hasUnsavedChanges={hasUnsavedChanges}
              onClose={() => setIsHistoryOpen(false)}
              onRestore={(id) => void handleRestoreSnapshot(id)}
            />
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
                  onSelectRoad={selectRoadFromList}
                  onNameChange={(value) => selectedRoad && patchRoad(selectedRoad.id, { name: value })}
                  onKindChange={(kind: RoadKind) =>
                    selectedRoad && patchRoad(selectedRoad.id, { kind, widthMeters: ROAD_KIND_DEFAULT_WIDTH[kind] }, `を${ROAD_KIND_LABELS[kind]}に変更`)
                  }
                  onWiderClick={() => selectedRoad && patchRoad(selectedRoad.id, { widthMeters: Math.min(90, selectedRoad.widthMeters + 4) }, "の道幅を変更")}
                  onNarrowerClick={() => selectedRoad && patchRoad(selectedRoad.id, { widthMeters: Math.max(8, selectedRoad.widthMeters - 4) }, "の道幅を変更")}
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
          {/* isRoadCreationDisabled の理由はファイル冒頭の定義部コメント参照 */}
          <span
            onClick={() => {
              if (isRoadCreationDisabled) return;
              setRoadAction((prev) => (prev === "draw" ? "idle" : "draw"));
              // 描いている道の頂点ハンドルと接続先の点が重なって紛らわしくならないよう、
              // 道を描き始めるときは選択中の道をいったん外す
              setSelectedRoadId(null);
            }}
            title={isRoadCreationDisabled ? "公開マップ側の複数道対応が完了するまで、新しい道の追加は一時的に無効化しています" : undefined}
            style={{
              padding: "8px 13px",
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: isRoadCreationDisabled ? "not-allowed" : "pointer",
              background: isRoadCreationDisabled ? "#F5F1E6" : roadAction === "draw" ? "#92400E" : "#FFF7E6",
              color: isRoadCreationDisabled ? "#B5AA92" : roadAction === "draw" ? "#fff" : "#92400E",
              border: "1px solid #E0B877",
              opacity: isRoadCreationDisabled ? 0.6 : 1,
            }}
          >
            {roadAction === "draw" ? "通り道を指定中…" : "＋ 道を追加（準備中）"}
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
