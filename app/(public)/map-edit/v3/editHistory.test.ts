import { describe, expect, it } from "vitest";
import {
  EMPTY_HISTORY,
  COALESCE_WINDOW_MS,
  diffStates,
  focusOfOperation,
  netChanges,
  recordOperation,
  redoOperation,
  undoOperation,
  type EditHistory,
  type EditState,
} from "./editHistory";
import type { EditableRoad, EditableShop } from "./types";

function shop(locationId: string, overrides: Partial<EditableShop> = {}): EditableShop {
  return { locationId, id: 1, position: 1, name: `未設定店舗 1`, lat: 33.56, lng: 133.53, ...overrides };
}

function road(id: string, pointCount: number): EditableRoad {
  return {
    id,
    name: id,
    kind: "market",
    widthMeters: 36,
    points: Array.from({ length: pointCount }, (_, i) => ({
      id: `${id}-p${i}`,
      lat: 33.56,
      lng: 133.53 + i * 0.001,
      order: i,
      roadId: id,
    })),
  };
}

const base: EditState = {
  shops: [shop("a"), shop("b", { position: 2 })],
  roads: [road("r1", 3), road("r2", 2)],
  landmarks: [],
  vendors: [],
};

function record(history: EditHistory, before: EditState, after: EditState, extra: { coalesceKey?: string; recordedAt?: number } = {}) {
  return recordOperation(history, {
    id: history.past.length + 1,
    label: "テスト",
    text: "変更",
    recordedAt: extra.recordedAt ?? 0,
    coalesceKey: extra.coalesceKey,
    before,
    after,
  });
}

describe("diffStates", () => {
  it("変わった要素だけを取り出す", () => {
    const after = { ...base, shops: [shop("a", { name: "店A" }), base.shops[1]] };
    const changes = diffStates(base, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ kind: "shops", id: "a", beforeIndex: 0, afterIndex: 0 });
  });

  it("追加と削除を before/after の null で表す", () => {
    const after = { ...base, shops: [base.shops[0], shop("c")] };
    const changes = diffStates(base, after);
    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "b", after: null }),
        expect.objectContaining({ id: "c", before: null }),
      ])
    );
  });
});

describe("取り消しとやり直し", () => {
  it("道の点の削除を取り消すと元の点の並びに戻り、やり直すと再び消える", () => {
    const removed = { ...base, roads: [{ ...base.roads[0], points: base.roads[0].points.filter((p) => p.id !== "r1-p1") }, base.roads[1]] };
    const history = record(EMPTY_HISTORY, base, removed);

    const undone = undoOperation(history, removed)!;
    expect(undone.state.roads[0].points.map((p) => p.id)).toEqual(["r1-p0", "r1-p1", "r1-p2"]);
    expect(undone.history.future).toHaveLength(1);

    const redone = redoOperation(undone.history, undone.state)!;
    expect(redone.state.roads[0].points.map((p) => p.id)).toEqual(["r1-p0", "r1-p2"]);
    expect(redone.history.past).toHaveLength(1);
  });

  it("削除した道を取り消すと元の並び順の位置に戻る", () => {
    const removed = { ...base, roads: [base.roads[1]] };
    const history = record(EMPTY_HISTORY, base, removed);
    const undone = undoOperation(history, removed)!;
    expect(undone.state.roads.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("新しい操作を記録すると、やり直し用の記録は捨てる", () => {
    const step1 = { ...base, shops: [shop("a", { name: "1" }), base.shops[1]] };
    let history = record(EMPTY_HISTORY, base, step1);
    const undone = undoOperation(history, step1)!;
    const step2 = { ...undone.state, shops: [shop("a", { name: "2" }), base.shops[1]] };
    history = record(undone.history, undone.state, step2);
    expect(history.future).toHaveLength(0);
    expect(redoOperation(history, step2)).toBeNull();
  });

  it("記録が空なら取り消し・やり直しはしない", () => {
    expect(undoOperation(EMPTY_HISTORY, base)).toBeNull();
    expect(redoOperation(EMPTY_HISTORY, base)).toBeNull();
  });
});

describe("recordOperation のまとめ", () => {
  it("変化のない操作は記録しない", () => {
    expect(record(EMPTY_HISTORY, base, base)).toBe(EMPTY_HISTORY);
  });

  it("同じキーの操作が続けば1件にまとめ、取り消すと最初の状態へ戻る", () => {
    const s1 = { ...base, shops: [shop("a", { name: "店" }), base.shops[1]] };
    const s2 = { ...base, shops: [shop("a", { name: "店A" }), base.shops[1]] };
    let history = record(EMPTY_HISTORY, base, s1, { coalesceKey: "name:a", recordedAt: 0 });
    history = record(history, s1, s2, { coalesceKey: "name:a", recordedAt: 500 });
    expect(history.past).toHaveLength(1);
    expect(undoOperation(history, s2)!.state.shops[0].name).toBe("未設定店舗 1");
  });

  it("時間が空いた操作はまとめない", () => {
    const s1 = { ...base, shops: [shop("a", { name: "店" }), base.shops[1]] };
    const s2 = { ...base, shops: [shop("a", { name: "店A" }), base.shops[1]] };
    let history = record(EMPTY_HISTORY, base, s1, { coalesceKey: "name:a", recordedAt: 0 });
    history = record(history, s1, s2, { coalesceKey: "name:a", recordedAt: COALESCE_WINDOW_MS + 1 });
    expect(history.past).toHaveLength(2);
  });

  it("まとめた結果が元どおりなら操作ごと消す", () => {
    const s1 = { ...base, shops: [shop("a", { name: "店" }), base.shops[1]] };
    let history = record(EMPTY_HISTORY, base, s1, { coalesceKey: "name:a", recordedAt: 0 });
    history = record(history, s1, base, { coalesceKey: "name:a", recordedAt: 100 });
    expect(history.past).toHaveLength(0);
  });
});

describe("netChanges（保存時の差分）", () => {
  it("同じ要素への複数の操作を最初の before と最後の after にたたむ", () => {
    const s1 = { ...base, shops: [shop("a", { lat: 1 }), base.shops[1]] };
    const s2 = { ...base, shops: [shop("a", { lat: 2 }), base.shops[1]] };
    let history = record(EMPTY_HISTORY, base, s1);
    history = record(history, s1, s2);
    const changes = netChanges(history);
    expect(changes).toHaveLength(1);
    expect(changes[0].before).toMatchObject({ lat: 33.56 });
    expect(changes[0].after).toMatchObject({ lat: 2 });
  });

  it("追加してから削除した要素は差分に含めない", () => {
    const added = { ...base, shops: [...base.shops, shop("new-1")] };
    let history = record(EMPTY_HISTORY, base, added);
    history = record(history, added, base);
    expect(netChanges(history)).toHaveLength(0);
  });

  it("行って戻っただけの要素は差分に含めない", () => {
    const moved = { ...base, shops: [shop("a", { lat: 1 }), base.shops[1]] };
    let history = record(EMPTY_HISTORY, base, moved);
    history = record(history, moved, base);
    expect(netChanges(history)).toHaveLength(0);
  });
});

describe("出店者の記録", () => {
  it("出店者の新規登録と区画への割り当てを1件の操作として記録し、取り消せる", () => {
    const vendor = { id: "new-vendor-1", name: "新しい店", categoryId: null, strength: "", mainProducts: [] };
    const after: EditState = {
      ...base,
      vendors: [vendor],
      shops: [shop("a", { vendorId: vendor.id, name: vendor.name }), base.shops[1]],
    };
    const history = record(EMPTY_HISTORY, base, after);
    expect(history.past[0].changes.map((c) => c.kind).sort()).toEqual(["shops", "vendors"]);
    const undone = undoOperation(history, after)!;
    expect(undone.state.vendors).toEqual([]);
    expect(undone.state.shops[0].vendorId).toBeUndefined();
  });

  it("出店者だけの変更は地図を寄せる位置を持たない", () => {
    const before: EditState = { ...base, vendors: [{ id: "v1", name: "店", categoryId: null, strength: "", mainProducts: [] }] };
    const after: EditState = { ...base, vendors: [{ ...before.vendors[0], strength: "朝どれ野菜" }] };
    expect(focusOfOperation(record(EMPTY_HISTORY, before, after).past[0])).toBeNull();
  });
});

describe("focusOfOperation", () => {
  it("区画の変更は区画の位置、道の変更は道の中心を返す", () => {
    const shopMoved = { ...base, shops: [shop("a", { lat: 10, lng: 20 }), base.shops[1]] };
    expect(focusOfOperation(record(EMPTY_HISTORY, base, shopMoved).past[0])).toEqual({ lat: 10, lng: 20 });

    const roadRenamed = { ...base, roads: [{ ...base.roads[0], name: "改名" }, base.roads[1]] };
    const focus = focusOfOperation(record(EMPTY_HISTORY, base, roadRenamed).past[0]);
    expect(focus?.lat).toBeCloseTo(33.56);
  });
});
