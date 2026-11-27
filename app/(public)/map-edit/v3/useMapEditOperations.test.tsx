import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { DEFAULT_MAP_ROUTE_CONFIG } from "../../map/types/mapRoute";
import { EMPTY_HISTORY, type EditHistory } from "./editHistory";
import { useMapEditOperations } from "./useMapEditOperations";
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


describe("住所番号", () => {
  it("枝番付き住所を別の場所として設定し、取り消せる", () => {
    const { hook } = setup([slot(1, 5, { officialNumber: 183, branchNumber: 1 }), slot(2, 15)]);
    act(() => { expect(hook.result.current.ops.setSlotAddress("loc-2", { main: 183, branch: 2 })).toBe(true); });
    expect(hook.result.current.shops[1]).toMatchObject({ officialNumber: 183, branchNumber: 2 });
    act(() => hook.result.current.ops.undo());
    expect(hook.result.current.shops[1].officialNumber).toBeUndefined();
  });
  it("同じ住所の別のピンを作らない", () => {
    const { hook, setMessage } = setup([slot(1, 5, { officialNumber: 183, branchNumber: 1 }), slot(2, 15)]);
    act(() => { expect(hook.result.current.ops.setSlotAddress("loc-2", { main: 183, branch: 1 })).toBe(false); });
    expect(setMessage).toHaveBeenCalledWith(expect.stringContaining("すでにあります"));
    expect(hook.result.current.history.past).toHaveLength(0);
  });
});

describe("現場位置の確認", () => {
  const vendor: EditableVendor = { id: "v1", name: "店", categoryId: null, strength: "", mainProducts: [], fieldObservation: { lat: 33.56, lng: 133.53, storeNumber: 1, accuracyM: 10, source: "gps", updatedAt: "2026-11-01T00:00:00Z" } };
  it("確認した位置を編集履歴に追加し、道との紐づけを外して取り消せる", () => {
    const { hook } = setup([slot(1, 5, { vendorId: "v1" })], 300, [vendor]);
    act(() => hook.result.current.ops.applyFieldObservation("loc-1"));
    expect(hook.result.current.shops[0]).toMatchObject({ lat: 33.56, lng: 133.53, roadId: undefined, roadDistanceM: undefined });
    expect(hook.result.current.history.past).toHaveLength(1);
    act(() => hook.result.current.ops.undo());
    expect(hook.result.current.shops[0]).toMatchObject({ roadId: "r1", roadDistanceM: 5 });
  });
  it("名前付きの共通場所には過去の個別記録を適用しない", () => {
    const { hook } = setup([slot(1, 5, { vendorId: "v1", placeName: "一丁目 南 2" })], 300, [vendor]);
    act(() => hook.result.current.ops.applyFieldObservation("loc-1"));
    expect(hook.result.current.history.past).toHaveLength(0);
  });
});

describe("場所に登録済みの店舗", () => {
  it("公開配置がなくても別の区画に割り当てない", () => {
    const { hook, setMessage } = setup([slot(1, 5, { placeName: "一丁目", placeVendors: [{ id: "va", name: "店A" }] }), slot(2, 15)], 300, [vendor("va", "店A")]);
    act(() => hook.result.current.ops.assignVendor("loc-2", "va"));
    expect(hook.result.current.shops[1].vendorId).toBeUndefined();
    expect(hook.result.current.history.past).toHaveLength(0);
    expect(setMessage).toHaveBeenCalledWith(expect.stringContaining("現場登録"));
  });
});

describe("useMapEditOperations.deleteSlot", () => {
  it("名前付きの出店場所は出店者が表示されていなくても削除しない", () => {
    const { hook, setMessage } = setup([slot(1, 5, { placeName: "一丁目 南 2", placeVendors: [] })]);
    act(() => { expect(hook.result.current.ops.deleteSlot("loc-1")).toBe(false); });
    expect(hook.result.current.shops).toHaveLength(1);
    expect(setMessage).toHaveBeenCalledWith(expect.stringContaining("出店場所"));
  });

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
  it("名前付きの出店場所へはドラッグで店舗を移さない", () => {
    const { hook, setMessage } = setup([slot(1, 5, { vendorId: "va", name: "店A" }), slot(2, 15, { placeName: "一丁目 南 2", placeVendors: [] })], 300, [vendor("va", "店A")]);
    act(() => { expect(hook.result.current.ops.moveVendor("loc-1", "loc-2")).toBe(false); });
    expect(hook.result.current.shops[0].vendorId).toBe("va");
    expect(setMessage).toHaveBeenCalledWith(expect.stringContaining("現場登録"));
  });

  it("名前のない普通の区画に公開配置の店舗情報があっても、ドラッグで移せる", () => {
    const { hook } = setup(
      [slot(1, 5, { vendorId: "va", name: "店A", placeVendors: [{ id: "va", name: "店A" }] }), slot(2, 15)],
      300,
      [vendor("va", "店A")]
    );
    act(() => { expect(hook.result.current.ops.moveVendor("loc-1", "loc-2")).toBe(true); });
    expect(hook.result.current.shops.map((s) => s.vendorId)).toEqual([undefined, "va"]);
  });

  it("名前のない普通の区画に公開配置の店舗情報があっても、別の区画へ割り当てられる", () => {
    const { hook } = setup(
      [slot(1, 5, { vendorId: "va", name: "店A", placeVendors: [{ id: "va", name: "店A" }] }), slot(2, 15)],
      300,
      [vendor("va", "店A")]
    );
    act(() => hook.result.current.ops.assignVendor("loc-2", "va"));
    expect(hook.result.current.shops.map((s) => s.vendorId)).toEqual([undefined, "va"]);
  });

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

describe("useMapEditOperations.setSlotChome", () => {
  it("丁目を選ぶと手動設定になり、取り消せる", () => {
    const { hook } = setup([slot(1, 5, { chome: "一丁目" })]);
    act(() => hook.result.current.ops.setSlotChome("loc-1", "二丁目"));
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

describe("useMapEditOperations.addSlot", () => {
  it("道の上に、空いている店番で空きの出店場所を1つ追加し、取り消せる", () => {
    const { hook } = setup([slot(1, 5, { chome: "一丁目" })]);
    act(() => {
      expect(hook.result.current.ops.addSlot(road)).toBe(true);
    });
    const added = hook.result.current.shops.find((s) => s.locationId.startsWith("new-"));
    expect(added).toMatchObject({ roadId: road.id, roadSide: "left", position: 2 });
    expect(added?.vendorId).toBeUndefined();
    act(() => hook.result.current.ops.undo());
    expect(hook.result.current.shops).toHaveLength(1);
  });

  it("追加した空きの出店場所は、削除できる", () => {
    const { hook } = setup([]);
    act(() => {
      hook.result.current.ops.addSlot(road);
    });
    const added = hook.result.current.shops[0];
    act(() => {
      expect(hook.result.current.ops.deleteSlot(added.locationId)).toBe(true);
    });
    expect(hook.result.current.shops).toHaveLength(0);
  });
});

describe("useMapEditOperations.addShopAt", () => {
  it("道に乗せず、タップした場所に空いている店番で出店場所を1つ置き、取り消せる", () => {
    const { hook } = setup([slot(1, 5, { chome: "一丁目" })]);
    let id: string | null = null;
    act(() => {
      id = hook.result.current.ops.addShopAt(33.5, 133.6);
    });
    expect(id).not.toBeNull();
    const added = hook.result.current.shops.find((s) => s.locationId === id);
    expect(added).toMatchObject({ position: 2, lat: 33.5, lng: 133.6 });
    expect(added?.roadId).toBeUndefined();
    expect(added?.roadDistanceM).toBeUndefined();
    act(() => hook.result.current.ops.undo());
    expect(hook.result.current.shops).toHaveLength(1);
  });

  it("緯度経度が有限でなければ置かない", () => {
    const { hook } = setup([]);
    act(() => {
      expect(hook.result.current.ops.addShopAt(Number.NaN, 133.6)).toBeNull();
    });
    expect(hook.result.current.shops).toHaveLength(0);
  });
});
