import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { DEFAULT_MAP_ROUTE_CONFIG } from "../../map/types/mapRoute";
import { EMPTY_HISTORY, type EditHistory } from "./editHistory";
import { planRoadSlots } from "./slotSplitPlan";
import { DEFAULT_SLOT_OFFSET_M, useMapEditOperations } from "./useMapEditOperations";
import type { EditableLandmark, EditableRoad, EditableShop } from "./types";

const road: EditableRoad = {
  id: "r1",
  name: "テスト通り",
  kind: "market",
  widthMeters: 36,
  points: [
    { id: "p0", lat: 33.56141, lng: 133.53, order: 0, roadId: "r1" },
    { id: "p1", lat: 33.56141, lng: 133.533, order: 1, roadId: "r1" },
  ],
};

const slot = (position: number, distanceM: number, extra: Partial<EditableShop> = {}): EditableShop => ({
  locationId: `loc-${position}`,
  id: position,
  position,
  name: `未設定店舗 ${position}`,
  lat: 0,
  lng: 0,
  roadId: "r1",
  roadDistanceM: distanceM,
  roadSide: "left",
  roadOffsetM: 8,
  chome: "一丁目",
  ...extra,
});

function setup(initialShops: EditableShop[], maxUnassigned = 300) {
  const setMessage = vi.fn();
  const hook = renderHook(() => {
    const [history, setHistory] = useState<EditHistory>(EMPTY_HISTORY);
    const [shops, setShops] = useState(initialShops);
    const [roads, setRoads] = useState([road]);
    const [landmarks, setLandmarks] = useState<EditableLandmark[]>([]);
    const ops = useMapEditOperations({
      history,
      setHistory,
      shops,
      setShops,
      roads,
      setRoads,
      landmarks,
      setLandmarks,
      routeConfig: DEFAULT_MAP_ROUTE_CONFIG,
      vendorOptions: [],
      mapSettingsLimits: { maxLandmarks: 80, maxUnassignedShopMarkers: maxUnassigned },
      setMessage,
    });
    return { ops, shops, history };
  });
  return { hook, setMessage };
}

const settings = { mode: "count" as const, count: 3, intervalM: 10, sides: "left" as const, startM: 0, endM: 30 };

describe("useMapEditOperations.applySlotPlan", () => {
  it("足りない区画を空いている店番で作り、同じ道の区画に合わせた位置・丁目にする", () => {
    const existing = [slot(1, 5), slot(3, 15, { roadOffsetM: 10 })];
    const { hook } = setup(existing);
    const plan = planRoadSlots(250, settings, [
      { locationId: "loc-1", side: "left", distanceM: 5, hasVendor: false },
      { locationId: "loc-3", side: "left", distanceM: 15, hasVendor: false },
    ]);
    act(() => {
      expect(hook.result.current.ops.applySlotPlan(road, plan)).toBe(true);
    });
    const created = hook.result.current.shops.filter((s) => s.locationId.startsWith("new-"));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ position: 2, roadId: "r1", roadSide: "left", roadDistanceM: 25, roadOffsetM: 9, chome: "一丁目" });
    expect(created[0].lat).toBeGreaterThan(33.56141);
    expect(hook.result.current.history.past).toHaveLength(1);
  });

  it("取り消すと区画分けの前に戻る", () => {
    const { hook } = setup([]);
    const plan = planRoadSlots(250, settings, []);
    act(() => {
      hook.result.current.ops.applySlotPlan(road, plan);
    });
    expect(hook.result.current.shops).toHaveLength(3);
    expect(hook.result.current.shops[0].roadOffsetM).toBe(DEFAULT_SLOT_OFFSET_M);
    act(() => hook.result.current.ops.undo());
    expect(hook.result.current.shops).toHaveLength(0);
  });

  it("空き区画の上限を超えるときは当てはめずに知らせる", () => {
    const { hook, setMessage } = setup([], 2);
    const plan = planRoadSlots(250, settings, []);
    act(() => {
      expect(hook.result.current.ops.applySlotPlan(road, plan)).toBe(false);
    });
    expect(setMessage).toHaveBeenCalledWith(expect.stringContaining("上限（2 件）"));
    expect(hook.result.current.shops).toHaveLength(0);
  });
});

describe("useMapEditOperations.deleteSlot", () => {
  it("出店者のいる区画は削除せず、先に空きにするよう知らせる", () => {
    const { hook, setMessage } = setup([slot(1, 5, { vendorId: "v1", name: "店A" }), slot(2, 15)]);
    act(() => {
      expect(hook.result.current.ops.deleteSlot("loc-1")).toBe(false);
    });
    expect(setMessage).toHaveBeenCalledWith(expect.stringContaining("空きにする"));
    act(() => {
      expect(hook.result.current.ops.deleteSlot("loc-2")).toBe(true);
    });
    expect(hook.result.current.shops.map((s) => s.locationId)).toEqual(["loc-1"]);
  });
});
