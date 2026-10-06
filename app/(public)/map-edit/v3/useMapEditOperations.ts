import { useCallback, useRef } from "react";
import { findNearestRoadId as findNearestRoadIdShared } from "../../map/utils/mapRouteGeometry";
import type { MapRouteConfig, MapRoutePoint } from "../../map/types/mapRoute";
import {
  recordOperation,
  redoOperation,
  undoOperation,
  type EditHistory,
  type EditState,
} from "./editHistory";
import { offsetLatLng, pointAtT } from "./roadPlacement";
import {
  ROAD_KIND_DEFAULT_WIDTH,
  type EditableLandmark,
  type EditableRoad,
  type EditableShop,
  type VendorOption,
} from "./types";
import type { MapSettingsLimits } from "./useMapEditData";

let operationIdCounter = 0;

/** 記録に付ける補足（同じ入力欄への連続入力を1件にまとめるキーなど） */
export type CommitOptions = { coalesceKey?: string };

type Params = {
  /** 操作の記録。保存・復元の処理（useMapEditData）も参照するため、呼び出し側が持つ */
  history: EditHistory;
  setHistory: React.Dispatch<React.SetStateAction<EditHistory>>;
  shops: EditableShop[];
  setShops: React.Dispatch<React.SetStateAction<EditableShop[]>>;
  roads: EditableRoad[];
  setRoads: React.Dispatch<React.SetStateAction<EditableRoad[]>>;
  landmarks: EditableLandmark[];
  setLandmarks: React.Dispatch<React.SetStateAction<EditableLandmark[]>>;
  routeConfig: MapRouteConfig;
  vendorOptions: VendorOption[];
  mapSettingsLimits: MapSettingsLimits;
  setMessage: (message: string | null) => void;
};

/** 空き区画の表示名（出店者がいない区画は店番から名前を作る） */
export function vacantShopName(position: number) {
  return `未設定店舗 ${position}`;
}

/**
 * マップ編集の編集操作と、その記録（取り消し・やり直し）を持つ。
 *
 * 編集操作はすべて commit / commitTransition を通して状態を変える。
 * 通さずに状態だけ変えると、変更一覧・取り消し・保存のどれにも載らない変更に
 * なってしまうため（ドラッグ中の見た目だけの更新は例外で、終了時に記録する）。
 */
export function useMapEditOperations(params: Params) {
  const {
    history,
    setHistory,
    shops,
    setShops,
    roads,
    setRoads,
    landmarks,
    setLandmarks,
    routeConfig,
    vendorOptions,
    mapSettingsLimits,
    setMessage,
  } = params;

  // ドラッグ開始時点の状態。ドラッグ中は記録せずに見た目だけ動かし、
  // ドラッグを終えた時点で「開始時点 → 終了時点」を1件の操作として記録する
  const dragBeforeRef = useRef<EditState | null>(null);

  const currentState = useCallback((): EditState => ({ shops, roads, landmarks }), [shops, roads, landmarks]);

  const applyState = useCallback(
    (next: EditState) => {
      if (next.shops !== shops) setShops(next.shops);
      if (next.roads !== roads) setRoads(next.roads);
      if (next.landmarks !== landmarks) setLandmarks(next.landmarks);
    },
    [shops, roads, landmarks, setShops, setRoads, setLandmarks]
  );

  /** 状態を before → after に変え、その変化を1件の操作として記録する */
  const commitTransition = useCallback(
    (before: EditState, after: EditState, label: string, text: string, options: CommitOptions = {}) => {
      applyState(after);
      operationIdCounter += 1;
      const id = operationIdCounter;
      setHistory((prev) =>
        recordOperation(prev, { id, label, text, coalesceKey: options.coalesceKey, recordedAt: Date.now(), before, after })
      );
    },
    [applyState, setHistory]
  );

  const commit = useCallback(
    (next: Partial<EditState>, label: string, text: string, options?: CommitOptions) => {
      const before = currentState();
      commitTransition(before, { ...before, ...next }, label, text, options);
    },
    [currentState, commitTransition]
  );

  const undo = useCallback(() => {
    const result = undoOperation(history, currentState());
    if (!result) return;
    applyState(result.state);
    setHistory(result.history);
  }, [history, currentState, applyState, setHistory]);

  const redo = useCallback(() => {
    const result = redoOperation(history, currentState());
    if (!result) return;
    applyState(result.state);
    setHistory(result.history);
  }, [history, currentState, applyState, setHistory]);

  // サーバー側（app/api/admin/map-layout/_shared.ts）と同じ判定ロジックを使うため、
  // 共通実装（mapRouteGeometry.ts）をそのまま呼ぶ（別々に実装すると、保存時に
  // サーバーが検証する道の割り当てとエディタの表示がズレる恐れがあるため）
  const findNearestRoadId = useCallback(
    (point: { lat: number; lng: number }): string | null =>
      findNearestRoadIdShared(point, roads, routeConfig.snapDistanceMeters),
    [roads, routeConfig.snapDistanceMeters]
  );

  const shopCountOnRoad = useCallback(
    (roadId: string) => shops.filter((s) => findNearestRoadId({ lat: s.lat, lng: s.lng }) === roadId).length,
    [shops, findNearestRoadId]
  );

  // ── 区画・出店者 ──────────────────────────────
  /** 出店者を別の空き区画へ移す。移せなかったら false */
  const moveVendor = useCallback(
    (fromLocationId: string, toLocationId: string): boolean => {
      const from = shops.find((s) => s.locationId === fromLocationId);
      const to = shops.find((s) => s.locationId === toLocationId);
      if (!from || !to || !from.vendorId || to.vendorId || from.locationId === to.locationId) return false;
      commit(
        {
          shops: shops.map((s) => {
            if (s.locationId === from.locationId) return { ...s, vendorId: undefined, name: vacantShopName(s.position) };
            if (s.locationId === to.locationId) return { ...s, vendorId: from.vendorId, name: from.name };
            return s;
          }),
        },
        String(to.position),
        `${from.name} を ${from.position} から移動`
      );
      return true;
    },
    [shops, commit]
  );

  const assignVendor = useCallback(
    (locationId: string, vendorId: string) => {
      const shop = shops.find((s) => s.locationId === locationId);
      if (!shop) return;
      const vendor = vendorOptions.find((v) => v.id === vendorId);
      commit(
        {
          shops: shops.map((s) =>
            s.locationId === locationId
              ? { ...s, vendorId: vendorId || undefined, name: vendor?.name ?? vacantShopName(s.position) }
              : s
          ),
        },
        String(shop.position),
        vendor ? `${vendor.name} を割り当て` : "空きに変更"
      );
    },
    [shops, vendorOptions, commit]
  );

  const clearVendor = useCallback(
    (locationId: string) => {
      const shop = shops.find((s) => s.locationId === locationId);
      if (!shop) return;
      commit(
        {
          shops: shops.map((s) =>
            s.locationId === locationId ? { ...s, vendorId: undefined, name: vacantShopName(s.position) } : s
          ),
        },
        String(shop.position),
        `${shop.name} を空きに変更`
      );
    },
    [shops, commit]
  );

  const addSlotsToRoad = useCallback(
    (road: EditableRoad, count: number) => {
      const currentUnassignedCount = shops.filter((s) => !s.vendorId).length;
      if (currentUnassignedCount + count > mapSettingsLimits.maxUnassignedShopMarkers) {
        setMessage(`未割当マーカは最大 ${mapSettingsLimits.maxUnassignedShopMarkers} 件までです。`);
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
          name: vacantShopName(nextPosition + i),
          lat: offset.lat,
          lng: offset.lng,
        });
      }
      commit({ shops: [...shops, ...newShops] }, "道", `${road.name} に ${count} 区画を追加`);
    },
    [shops, findNearestRoadId, commit, setMessage, mapSettingsLimits.maxUnassignedShopMarkers]
  );

  // ── 道 ──────────────────────────────
  const patchRoad = useCallback(
    (roadId: string, patch: Partial<EditableRoad>, logText: string, options?: CommitOptions) => {
      const road = roads.find((r) => r.id === roadId);
      if (!road) return;
      commit({ roads: roads.map((r) => (r.id === roadId ? { ...r, ...patch } : r)) }, "道", `${road.name} ${logText}`, options);
    },
    [roads, commit]
  );

  /** 道を削除する。区画が乗っていて削除できなければ false */
  const deleteRoad = useCallback(
    (roadId: string): boolean => {
      const road = roads.find((r) => r.id === roadId);
      if (!road) return false;
      if (shopCountOnRoad(roadId) > 0) {
        setMessage(`${road.name} には区画があるため削除できません。`);
        return false;
      }
      commit({ roads: roads.filter((r) => r.id !== roadId) }, "道", `${road.name} を削除`);
      return true;
    },
    [roads, shopCountOnRoad, commit, setMessage]
  );

  /** 描いた点列から新しい道を作る。作った道の id を返す */
  const createRoad = useCallback(
    (draftPoints: { lat: number; lng: number }[]): string | null => {
      if (draftPoints.length < 2) return null;
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
      commit({ roads: [...roads, newRoad] }, "道", `${name} を追加（頂点${points.length}）`);
      return id;
    },
    [roads, commit]
  );

  const moveVertexLive = useCallback(
    (roadId: string, pointId: string, lat: number, lng: number) => {
      if (!dragBeforeRef.current) dragBeforeRef.current = currentState();
      setRoads((prev) =>
        prev.map((r) =>
          r.id === roadId ? { ...r, points: r.points.map((p) => (p.id === pointId ? { ...p, lat, lng } : p)) } : r
        )
      );
    },
    [currentState, setRoads]
  );

  // 終了時の座標は引数で受け取り、ドラッグ開始時点の状態に当てはめて「後」を作る
  // （最後の drag イベントによる状態更新がまだ描画に反映されていなくても、記録がずれないようにするため）
  const moveVertexEnd = useCallback(
    (roadId: string, pointId: string, lat: number, lng: number) => {
      const before = dragBeforeRef.current ?? currentState();
      dragBeforeRef.current = null;
      const road = before.roads.find((r) => r.id === roadId);
      if (!road) return;
      commitTransition(
        before,
        {
          ...before,
          roads: before.roads.map((r) =>
            r.id === roadId ? { ...r, points: r.points.map((p) => (p.id === pointId ? { ...p, lat, lng } : p)) } : r
          ),
        },
        "道",
        `${road.name} の形を変更`
      );
    },
    [currentState, commitTransition]
  );

  const removeVertex = useCallback(
    (roadId: string, pointId: string) => {
      const road = roads.find((r) => r.id === roadId);
      if (!road) return;
      if (road.points.length <= 2) {
        setMessage("道の点は2つより少なくできません。");
        return;
      }
      commit(
        { roads: roads.map((r) => (r.id === roadId ? { ...r, points: r.points.filter((p) => p.id !== pointId) } : r)) },
        "道",
        `${road.name} の点を削除`
      );
    },
    [roads, commit, setMessage]
  );

  const insertVertex = useCallback(
    (roadId: string, afterIndex: number, lat: number, lng: number) => {
      const road = roads.find((r) => r.id === roadId);
      if (!road) return;
      const newPoint: MapRoutePoint = { id: `${roadId}-p${Date.now()}`, lat, lng, order: afterIndex + 1, roadId };
      commit(
        {
          roads: roads.map((r) =>
            r.id === roadId
              ? { ...r, points: [...r.points.slice(0, afterIndex + 1), newPoint, ...r.points.slice(afterIndex + 1)] }
              : r
          ),
        },
        "道",
        `${road.name} に点を追加`
      );
    },
    [roads, commit]
  );

  // ── 建物 ──────────────────────────────
  const patchLandmark = useCallback(
    (key: string, patch: Partial<EditableLandmark>, logText: string, options?: CommitOptions) => {
      const landmark = landmarks.find((l) => l.key === key);
      if (!landmark) return;
      commit(
        { landmarks: landmarks.map((l) => (l.key === key ? { ...l, ...patch } : l)) },
        "建物",
        `${landmark.name} ${logText}`,
        options
      );
    },
    [landmarks, commit]
  );

  const deleteLandmark = useCallback(
    (key: string) => {
      const landmark = landmarks.find((l) => l.key === key);
      if (!landmark) return;
      commit({ landmarks: landmarks.filter((l) => l.key !== key) }, "建物", `${landmark.name} を削除`);
    },
    [landmarks, commit]
  );

  /** 建物を新しく置く。置いた建物の key を返す（上限を超えるときは null） */
  const addLandmark = useCallback(
    (lat: number, lng: number): string | null => {
      if (landmarks.length >= mapSettingsLimits.maxLandmarks) {
        setMessage(`建物オブジェクトは最大 ${mapSettingsLimits.maxLandmarks} 件までです。`);
        return null;
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
      commit({ landmarks: [...landmarks, newLandmark] }, "建物", "新しい建物を追加");
      return key;
    },
    [landmarks, commit, setMessage, mapSettingsLimits.maxLandmarks]
  );

  const moveLandmarkLive = useCallback(
    (key: string, lat: number, lng: number) => {
      if (!dragBeforeRef.current) dragBeforeRef.current = currentState();
      setLandmarks((prev) => prev.map((l) => (l.key === key ? { ...l, lat, lng } : l)));
    },
    [currentState, setLandmarks]
  );

  const moveLandmarkEnd = useCallback(
    (key: string, lat: number, lng: number) => {
      const before = dragBeforeRef.current ?? currentState();
      dragBeforeRef.current = null;
      const landmark = before.landmarks.find((l) => l.key === key);
      if (!landmark) return;
      commitTransition(
        before,
        { ...before, landmarks: before.landmarks.map((l) => (l.key === key ? { ...l, lat, lng } : l)) },
        "建物",
        `${landmark.name} を移動`
      );
    },
    [currentState, commitTransition]
  );

  return {
    undo,
    redo,
    findNearestRoadId,
    shopCountOnRoad,
    moveVendor,
    assignVendor,
    clearVendor,
    addSlotsToRoad,
    patchRoad,
    deleteRoad,
    createRoad,
    moveVertexLive,
    moveVertexEnd,
    removeVertex,
    insertVertex,
    patchLandmark,
    deleteLandmark,
    addLandmark,
    moveLandmarkLive,
    moveLandmarkEnd,
  };
}
