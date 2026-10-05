import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { DEFAULT_MAP_ROUTE_CONFIG } from "../../map/types/mapRoute";
import { EMPTY_HISTORY, type EditHistory } from "./editHistory";
import { planRoadSlots } from "./slotSplitPlan";
import { DEFAULT_SLOT_OFFSET_M, useMapEditOperations } from "./useMapEditOperations";
import type { JudgeChome } from "./useChomeJudge";
import type { EditableLandmark, EditableRoad, EditableShop, EditableVendor } from "./types";

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

function setup(
  initialShops: EditableShop[],
  maxUnassigned = 300,
  initialVendors: EditableVendor[] = [],
  judgeChome?: JudgeChome
) {
  const setMessage = vi.fn();
  const hook = renderHook(() => {
    const [history, setHistory] = useState<EditHistory>(EMPTY_HISTORY);
    const [shops, setShops] = useState(initialShops);
    const [roads, setRoads] = useState([road]);
    const [landmarks, setLandmarks] = useState<EditableLandmark[]>([]);
    const [vendors, setVendors] = useState(initialVendors);
    const ops = useMapEditOperations({
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
      routeConfig: DEFAULT_MAP_ROUTE_CONFIG,
      mapSettingsLimits: { maxLandmarks: 80, maxUnassignedShopMarkers: maxUnassigned },
      judgeChome,
      setMessage,
    });
    return { ops, shops, vendors, history };
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

const vendor = (id: string, name: string): EditableVendor => ({ id, name, categoryId: null, strength: "", mainProducts: [] });

describe("useMapEditOperations の出店者操作", () => {
  it("出店者のいる区画へ移すと入れ替わり、1回の取り消しで元に戻る", () => {
    const { hook } = setup(
      [slot(1, 5, { vendorId: "va", name: "店A" }), slot(2, 15, { vendorId: "vb", name: "店B" })],
      300,
      [vendor("va", "店A"), vendor("vb", "店B")]
    );
    act(() => {
      expect(hook.result.current.ops.moveVendor("loc-1", "loc-2")).toBe(true);
    });
    expect(hook.result.current.shops.map((s) => [s.position, s.vendorId, s.name])).toEqual([
      [1, "vb", "店B"],
      [2, "va", "店A"],
    ]);
    expect(hook.result.current.history.past.at(-1)?.text).toBe("店A（1）と 店B（2）を入れ替え");
    act(() => hook.result.current.ops.undo());
    expect(hook.result.current.shops.map((s) => s.vendorId)).toEqual(["va", "vb"]);
  });

  it("空き区画へ移すと移動元は空きになる", () => {
    const { hook } = setup([slot(1, 5, { vendorId: "va", name: "店A" }), slot(2, 15)], 300, [vendor("va", "店A")]);
    act(() => {
      hook.result.current.ops.moveVendor("loc-1", "loc-2");
    });
    expect(hook.result.current.shops.map((s) => [s.vendorId, s.name])).toEqual([
      [undefined, "未設定店舗 1"],
      ["va", "店A"],
    ]);
  });

  it("空き区画に新しい出店者を登録すると、出店者の追加と割り当てが1件の操作になる", () => {
    const { hook } = setup([slot(1, 5)]);
    let id: string | null = null;
    act(() => {
      id = hook.result.current.ops.registerVendor("loc-1", { name: " 朝市の八百屋 ", categoryId: null, strength: "", mainProducts: ["柚子"] });
    });
    expect(id).toMatch(/^new-vendor-/);
    expect(hook.result.current.vendors).toEqual([expect.objectContaining({ id, name: "朝市の八百屋" })]);
    expect(hook.result.current.shops[0]).toMatchObject({ vendorId: id, name: "朝市の八百屋" });
    expect(hook.result.current.history.past).toHaveLength(1);
  });

  it("店名を直すと、その出店者の区画の表示名も揃う", () => {
    const { hook } = setup([slot(1, 5, { vendorId: "va", name: "店A" })], 300, [vendor("va", "店A")]);
    act(() => hook.result.current.ops.updateVendor("va", { name: "店A改" }, "の店名を変更"));
    expect(hook.result.current.shops[0].name).toBe("店A改");
    expect(hook.result.current.vendors[0].name).toBe("店A改");
  });

  it("別の区画にいる出店者を割り当てると、元の区画は空きになる", () => {
    const { hook } = setup([slot(1, 5, { vendorId: "va", name: "店A" }), slot(2, 15)], 300, [vendor("va", "店A")]);
    act(() => hook.result.current.ops.assignVendor("loc-2", "va"));
    expect(hook.result.current.shops.map((s) => s.vendorId)).toEqual([undefined, "va"]);
    expect(hook.result.current.history.past.at(-1)?.text).toBe("店A を 1 から移して割り当て");
  });

  it("空きにしても出店者の情報は消えない", () => {
    const { hook } = setup([slot(1, 5, { vendorId: "va", name: "店A" })], 300, [vendor("va", "店A")]);
    act(() => hook.result.current.ops.clearVendor("loc-1"));
    expect(hook.result.current.shops[0].vendorId).toBeUndefined();
    expect(hook.result.current.vendors).toHaveLength(1);
  });
});

describe("丁目の自動判定", () => {
  const plan3 = () => planRoadSlots(250, settings, []);

  it("区画分けで置いた区画は、道の位置から判定した丁目になる（近くの区画に合わせない）", () => {
    const judge: JudgeChome = (_roadId, distanceM) => ({ status: "ok", chomeId: distanceM < 20 ? 3 : 4 });
    const { hook } = setup([slot(1, 5, { chome: "一丁目" })], 300, [], judge);
    act(() => {
      hook.result.current.ops.applySlotPlan(road, planRoadSlots(250, settings, [{ locationId: "loc-1", side: "left", distanceM: 5, hasVendor: false }]));
    });
    const created = hook.result.current.shops.filter((s) => s.locationId.startsWith("new-"));
    expect(created.map((s) => s.chome)).toEqual(["三丁目", "四丁目"]);
  });

  it("境目のすぐ上の区画は丁目を空けて、知らせる", () => {
    const judge: JudgeChome = () => ({ status: "near_boundary", chomeId: null, candidates: [3, 4] });
    const { hook, setMessage } = setup([], 300, [], judge);
    act(() => {
      hook.result.current.ops.applySlotPlan(road, plan3());
    });
    expect(hook.result.current.shops.every((s) => s.chome === undefined)).toBe(true);
    expect(setMessage).toHaveBeenCalledWith(expect.stringContaining("境目のすぐ上"));
  });

  it("判定の対象外（境目の設定が無い）ときは、従来どおり近くの区画の丁目に合わせる", () => {
    const judge: JudgeChome = () => ({ status: "outside", chomeId: null });
    const { hook } = setup([slot(1, 5, { chome: "二丁目" })], 300, [], judge);
    act(() => {
      hook.result.current.ops.applySlotPlan(road, planRoadSlots(250, settings, [{ locationId: "loc-1", side: "left", distanceM: 5, hasVendor: false }]));
    });
    expect(hook.result.current.shops.filter((s) => s.locationId.startsWith("new-")).every((s) => s.chome === "二丁目")).toBe(true);
  });
});

describe("useMapEditOperations.setSlotChome", () => {
  it("丁目を選ぶと手動設定になり、取り消せる", () => {
    const { hook } = setup([slot(1, 5, { chome: "一丁目" })]);
    act(() => hook.result.current.ops.setSlotChome("loc-1", 2));
    expect(hook.result.current.shops[0]).toMatchObject({ chome: "二丁目", chomeLocked: true });
    act(() => hook.result.current.ops.undo());
    expect(hook.result.current.shops[0]).toMatchObject({ chome: "一丁目" });
    expect(hook.result.current.shops[0].chomeLocked).toBeUndefined();
  });

  it("「自動」に戻すと手動設定を外し、道の位置から決め直す（保存で false を送る）", () => {
    const judge: JudgeChome = () => ({ status: "ok", chomeId: 5 });
    const { hook } = setup([slot(1, 5, { chome: "二丁目", chomeLocked: true })], 300, [], judge);
    act(() => hook.result.current.ops.setSlotChome("loc-1", "auto"));
    expect(hook.result.current.shops[0]).toMatchObject({ chome: "五丁目", chomeLocked: false });
  });

  it("「自動」でも判定できなければ、今の丁目を残して手動設定だけ外す", () => {
    const judge: JudgeChome = () => ({ status: "near_boundary", chomeId: null, candidates: [1, 2] });
    const { hook } = setup([slot(1, 5, { chome: "二丁目", chomeLocked: true })], 300, [], judge);
    act(() => hook.result.current.ops.setSlotChome("loc-1", "auto"));
    expect(hook.result.current.shops[0]).toMatchObject({ chome: "二丁目", chomeLocked: false });
  });
});
