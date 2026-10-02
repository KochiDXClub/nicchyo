import { useCallback, useRef } from "react";
import type { MapRouteConfig, MapRoutePoint } from "../../map/types/mapRoute";
import { roadIdOfSlot, roadSlotLatLng } from "@/lib/map/roadSlotPosition";
import { MAX_SHOP_ID, MIN_SHOP_ID } from "@/lib/shops/route";
import {
  recordOperation,
  redoOperation,
  undoOperation,
  type EditHistory,
  type EditState,
} from "./editHistory";
import type { SlotSplitPlan } from "./slotSplitPlan";
import {
  ROAD_KIND_DEFAULT_WIDTH,
  type EditableLandmark,
  type EditableRoad,
  type EditableShop,
  type EditableVendor,
} from "./types";
import { NEW_VENDOR_ID_PREFIX } from "../../map/types/editableShop";
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
  vendors: EditableVendor[];
  setVendors: React.Dispatch<React.SetStateAction<EditableVendor[]>>;
  routeConfig: MapRouteConfig;
  mapSettingsLimits: MapSettingsLimits;
  setMessage: (message: string | null) => void;
};

/** 空き区画の表示名（出店者がいない区画は店番から名前を作る） */
export function vacantShopName(position: number) {
  return `未設定店舗 ${position}`;
}

/**
 * 新しい区画を置く、道の中心線からの距離（m）の既定値。その道に区画が無いときに使う。
 * 実測（market_locations 300件）の店舗の中心線からの横距離の中央値（config/roadStyle.ts 参照）。
 */
export const DEFAULT_SLOT_OFFSET_M = 7.5;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 道に新しく置く区画の、道の中心線からの距離（m）。同じ道・同じ側の区画の中央値に揃え、
 * 無ければ同じ道の区画の中央値、それも無ければ既定値。区画分けのプレビューと適用の両方で使う。
 */
export function newSlotOffsetM(slotsOnRoad: EditableShop[], side: "left" | "right"): number {
  return (
    median(slotsOnRoad.filter((s) => s.roadSide === side).map((s) => s.roadOffsetM ?? 0)) ??
    median(slotsOnRoad.map((s) => s.roadOffsetM ?? 0)) ??
    DEFAULT_SLOT_OFFSET_M
  );
}

/** 使われていない店番を小さい順に count 個。足りなければ null */
function freePositions(used: Set<number>, count: number): number[] | null {
  const result: number[] = [];
  for (let n = MIN_SHOP_ID; n <= MAX_SHOP_ID && result.length < count; n += 1) {
    if (!used.has(n)) result.push(n);
  }
  return result.length === count ? result : null;
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
    vendors,
    setVendors,
    routeConfig,
    mapSettingsLimits,
    setMessage,
  } = params;

  // ドラッグ開始時点の状態。ドラッグ中は記録せずに見た目だけ動かし、
  // ドラッグを終えた時点で「開始時点 → 終了時点」を1件の操作として記録する
  const dragBeforeRef = useRef<EditState | null>(null);

  const currentState = useCallback(
    (): EditState => ({ shops, roads, landmarks, vendors }),
    [shops, roads, landmarks, vendors]
  );

  const applyState = useCallback(
    (next: EditState) => {
      if (next.shops !== shops) setShops(next.shops);
      if (next.roads !== roads) setRoads(next.roads);
      if (next.landmarks !== landmarks) setLandmarks(next.landmarks);
      if (next.vendors !== vendors) setVendors(next.vendors);
    },
    [shops, roads, landmarks, vendors, setShops, setRoads, setLandmarks, setVendors]
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

  // 区画が乗っている道。サーバー側（app/api/admin/map-layout/_shared.ts）と同じ共通実装
  // （roadSlotPosition.ts）を呼ぶ（別々に実装すると、保存時にサーバーが検証する道の割り当てと
  // エディタの表示がズレる恐れがあるため）
  const roadIdOf = useCallback(
    (shop: EditableShop): string | null => roadIdOfSlot(shop, roads, routeConfig.snapDistanceMeters),
    [roads, routeConfig.snapDistanceMeters]
  );

  const shopCountOnRoad = useCallback(
    (roadId: string) => shops.filter((s) => roadIdOf(s) === roadId).length,
    [shops, roadIdOf]
  );

  // ── 区画・出店者 ──────────────────────────────
  const vendorName = useCallback(
    (vendorId: string, list: EditableVendor[] = vendors) => list.find((v) => v.id === vendorId)?.name ?? "名称未設定",
    [vendors]
  );

  /**
   * 出店者を別の区画へ移す。移動先に別の出店者がいれば入れ替える。移動元は空きになる。
   * 移せなかったら false
   */
  const moveVendor = useCallback(
    (fromLocationId: string, toLocationId: string): boolean => {
      const from = shops.find((s) => s.locationId === fromLocationId);
      const to = shops.find((s) => s.locationId === toLocationId);
      if (!from || !to || !from.vendorId || from.locationId === to.locationId) return false;
      const movingName = vendorName(from.vendorId);
      const swapped = to.vendorId;
      commit(
        {
          shops: shops.map((s) => {
            if (s.locationId === from.locationId) {
              return swapped
                ? { ...s, vendorId: swapped, name: vendorName(swapped) }
                : { ...s, vendorId: undefined, name: vacantShopName(s.position) };
            }
            if (s.locationId === to.locationId) return { ...s, vendorId: from.vendorId, name: movingName };
            return s;
          }),
        },
        String(to.position),
        swapped
          ? `${movingName}（${from.position}）と ${vendorName(swapped)}（${to.position}）を入れ替え`
          : `${movingName} を ${from.position} から移動`
      );
      return true;
    },
    [shops, commit, vendorName]
  );

  /**
   * 区画に登録済みの出店者を割り当てる（空文字なら空きにする）。
   * その出店者が別の区画にいれば、そちらは空きにする（同じ出店者を2つの区画に置かないため）
   */
  const assignVendor = useCallback(
    (locationId: string, vendorId: string) => {
      const shop = shops.find((s) => s.locationId === locationId);
      if (!shop) return;
      const previous = vendorId ? shops.find((s) => s.vendorId === vendorId && s.locationId !== locationId) : undefined;
      commit(
        {
          shops: shops.map((s) => {
            if (s.locationId === locationId) {
              return { ...s, vendorId: vendorId || undefined, name: vendorId ? vendorName(vendorId) : vacantShopName(s.position) };
            }
            if (previous && s.locationId === previous.locationId) {
              return { ...s, vendorId: undefined, name: vacantShopName(s.position) };
            }
            return s;
          }),
        },
        String(shop.position),
        !vendorId
          ? "空きに変更"
          : previous
            ? `${vendorName(vendorId)} を ${previous.position} から移して割り当て`
            : `${vendorName(vendorId)} を割り当て`
      );
    },
    [shops, commit, vendorName]
  );

  /** 空き区画に新しい出店者を登録して割り当てる（1件の操作）。登録した出店者の仮 id を返す */
  const registerVendor = useCallback(
    (locationId: string, draft: Omit<EditableVendor, "id">): string | null => {
      const shop = shops.find((s) => s.locationId === locationId);
      if (!shop) return null;
      const id = `${NEW_VENDOR_ID_PREFIX}${Date.now()}`;
      const vendor: EditableVendor = { ...draft, id, name: draft.name.trim() };
      commit(
        {
          vendors: [...vendors, vendor],
          shops: shops.map((s) => (s.locationId === locationId ? { ...s, vendorId: id, name: vendor.name } : s)),
        },
        String(shop.position),
        `${vendor.name} を新しく登録`
      );
      return id;
    },
    [shops, vendors, commit]
  );

  /** 出店者の情報を直す。店名を変えたら、その出店者の区画の表示名も揃える */
  const updateVendor = useCallback(
    (vendorId: string, patch: Partial<Omit<EditableVendor, "id">>, logText: string, options?: CommitOptions) => {
      const vendor = vendors.find((v) => v.id === vendorId);
      if (!vendor) return;
      const nextVendor = { ...vendor, ...patch };
      commit(
        {
          vendors: vendors.map((v) => (v.id === vendorId ? nextVendor : v)),
          ...(patch.name !== undefined
            ? { shops: shops.map((s) => (s.vendorId === vendorId ? { ...s, name: nextVendor.name } : s)) }
            : {}),
        },
        "出店者",
        `${vendor.name} ${logText}`,
        options
      );
    },
    [vendors, shops, commit]
  );

  /** 区画を空きにする。出店者の情報は消さず、割り当てだけを外す */
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

  /** 区画を1つ削除する。出店者がいる区画は削除しない（先に空きにしてもらう）。削除できたら true */
  const deleteSlot = useCallback(
    (locationId: string): boolean => {
      const shop = shops.find((s) => s.locationId === locationId);
      if (!shop) return false;
      if (shop.vendorId) {
        setMessage(`区画 ${shop.position} には出店者がいます。先に「空きにする」で出店者を外してから削除してください。`);
        return false;
      }
      commit({ shops: shops.filter((s) => s.locationId !== locationId) }, String(shop.position), "区画を削除");
      return true;
    },
    [shops, commit, setMessage]
  );

  /**
   * 区画分けツールの結果（slotSplitPlan.ts の planRoadSlots）を当てはめる。
   * 残す区画は位置だけ動かし（店番・出店者はそのまま）、足りない分は空いている店番で新しく作り、
   * 多すぎる空き区画は消す。当てはめられたら true
   */
  const applySlotPlan = useCallback(
    (road: EditableRoad, plan: SlotSplitPlan): boolean => {
      if (plan.error) {
        setMessage(plan.error);
        return false;
      }
      const unassignedAfter = shops.filter((s) => !s.vendorId).length - plan.deletes.length + plan.creates.length;
      if (unassignedAfter > mapSettingsLimits.maxUnassignedShopMarkers) {
        setMessage(
          `空き区画が ${unassignedAfter} 件になり、上限（${mapSettingsLimits.maxUnassignedShopMarkers} 件）を超えます。上限は /admin/settings で変えられます。`
        );
        return false;
      }

      const deletedIds = new Set(plan.deletes.map((d) => d.locationId));
      const used = new Set(shops.filter((s) => !deletedIds.has(s.locationId)).map((s) => s.position));
      const positions = freePositions(used, plan.creates.length);
      if (!positions) {
        setMessage(`空いている店番（${MIN_SHOP_ID}〜${MAX_SHOP_ID}）が足りないため、区画を増やせません。`);
        return false;
      }

      const onRoad = shops.filter((s) => s.roadId === road.id && !deletedIds.has(s.locationId));
      // 新しい区画の丁目は、同じ道の上でいちばん近い区画に合わせる（区画レーンで丁目ごとにまとめるため）
      const chomeNear = (distanceM: number) =>
        onRoad
          .filter((s) => s.chome)
          .reduce<{ chome?: string; d: number }>(
            (best, s) => {
              const d = Math.abs((s.roadDistanceM ?? 0) - distanceM);
              return d < best.d ? { chome: s.chome, d } : best;
            },
            { chome: undefined, d: Infinity }
          ).chome;

      const moveTo = new Map(plan.moves.map((m) => [m.locationId, m.toM]));
      const nextShops = shops
        .filter((s) => !deletedIds.has(s.locationId))
        .map((s) => {
          const toM = moveTo.get(s.locationId);
          if (toM === undefined || !s.roadSide) return s;
          const latLng = roadSlotLatLng(road.points, { distanceM: toM, side: s.roadSide, offsetM: s.roadOffsetM ?? 0 });
          return { ...s, roadDistanceM: toM, ...latLng };
        });
      const stamp = Date.now();
      plan.creates.forEach((create, index) => {
        const position = positions[index];
        const offsetM = newSlotOffsetM(onRoad, create.side);
        nextShops.push({
          locationId: `new-${stamp}-${index}`,
          id: position,
          position,
          name: vacantShopName(position),
          chome: chomeNear(create.distanceM),
          roadId: road.id,
          roadDistanceM: create.distanceM,
          roadSide: create.side,
          roadOffsetM: offsetM,
          ...roadSlotLatLng(road.points, { distanceM: create.distanceM, side: create.side, offsetM }),
        });
      });

      commit(
        { shops: nextShops },
        "道",
        `${road.name} を区画分け（追加 ${plan.creates.length}・削除 ${plan.deletes.length}・移動 ${plan.moves.length}）`
      );
      return true;
    },
    [shops, commit, setMessage, mapSettingsLimits.maxUnassignedShopMarkers]
  );

  /** CSV 取り込みの結果（storeCsvImport.ts の planStoreImport）を1件の操作として当てはめる */
  const applyStoreImport = useCallback(
    (next: { shops: EditableShop[]; vendors: EditableVendor[] }, text: string) => {
      commit({ shops: next.shops, vendors: next.vendors }, "CSV", text);
    },
    [commit]
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
    roadIdOf,
    shopCountOnRoad,
    moveVendor,
    assignVendor,
    registerVendor,
    updateVendor,
    clearVendor,
    deleteSlot,
    applySlotPlan,
    applyStoreImport,
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
