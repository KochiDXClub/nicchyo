import { describe, expect, it } from "vitest";
import { initialSplitSettings, planRoadSlots, targetDistances, type SlotOnRoad, type SlotSplitSettings } from "./slotSplitPlan";

const settings = (patch: Partial<SlotSplitSettings> = {}): SlotSplitSettings => ({
  mode: "count",
  count: 4,
  intervalM: 10,
  sides: "left",
  startM: 0,
  endM: 40,
  ...patch,
});

const slot = (id: string, distanceM: number, hasVendor = false, side: "left" | "right" = "left"): SlotOnRoad => ({
  locationId: id,
  side,
  distanceM,
  hasVendor,
});

describe("targetDistances", () => {
  it("区画数で分けると、範囲を等分した各区画の中心に並ぶ", () => {
    expect(targetDistances(settings())).toEqual([5, 15, 25, 35]);
  });

  it("間隔で分けると、余りを両端に振り分けて中央に揃える", () => {
    expect(targetDistances(settings({ mode: "interval", intervalM: 12 }))).toEqual([8, 20, 32]);
  });
});

describe("planRoadSlots", () => {
  it("区画が無い道では、並べる位置にすべて新しく作る（両側なら左右それぞれ）", () => {
    const plan = planRoadSlots(100, settings({ sides: "both", count: 2 }), []);
    expect(plan.error).toBeNull();
    expect(plan.creates).toHaveLength(4);
    expect(plan.moves).toEqual([]);
  });

  it("区画を増やすときは、既存の区画を並び順どおりに近い位置へ動かし、足りない分を作る", () => {
    const plan = planRoadSlots(100, settings(), [slot("a", 4), slot("b", 16)]);
    expect(plan.error).toBeNull();
    expect(plan.moves).toEqual([
      expect.objectContaining({ locationId: "b", toM: 15 }),
      expect.objectContaining({ locationId: "a", toM: 5 }),
    ]);
    expect(plan.creates.map((c) => c.distanceM)).toEqual([25, 35]);
    expect(plan.deletes).toEqual([]);
  });

  it("位置が変わらない区画は keeps に入る", () => {
    const plan = planRoadSlots(100, settings(), [slot("a", 5), slot("b", 15), slot("c", 25), slot("d", 35)]);
    expect(plan.keeps).toHaveLength(4);
    expect(plan.moves).toEqual([]);
  });

  it("区画を減らすときは、出店者のいる区画を残して空き区画だけを消す", () => {
    const existing = [slot("a", 5), slot("b", 15, true), slot("c", 25), slot("d", 35, true)];
    const plan = planRoadSlots(100, settings({ count: 2 }), existing);
    expect(plan.error).toBeNull();
    expect(plan.deletes.map((d) => d.locationId).sort()).toEqual(["a", "c"]);
    const kept = [...plan.moves.map((m) => m.locationId), ...plan.keeps.map((k) => k.locationId)].sort();
    expect(kept).toEqual(["b", "d"]);
  });

  it("出店者のいる区画の数より減らせないときは理由を返し、何もしない", () => {
    const existing = [slot("a", 5, true), slot("b", 15, true), slot("c", 25, true)];
    const plan = planRoadSlots(100, settings({ count: 2 }), existing);
    expect(plan.error).toContain("出店者のいる区画が 3 件");
    expect([...plan.moves, ...plan.creates, ...plan.deletes]).toEqual([]);
  });

  it("選ばなかった側の区画には触らない", () => {
    const plan = planRoadSlots(100, settings({ count: 1 }), [slot("r1", 10, false, "right"), slot("r2", 20, false, "right")]);
    expect(plan.deletes).toEqual([]);
    expect(plan.creates).toHaveLength(1);
  });

  it("範囲や数が正しくない設定は理由を返す", () => {
    expect(planRoadSlots(30, settings(), []).error).toContain("0〜30m");
    expect(planRoadSlots(100, settings({ startM: 50, endM: 40 }), []).error).toContain("終了位置");
    expect(planRoadSlots(100, settings({ count: 1.5 }), []).error).toContain("整数");
    expect(planRoadSlots(100, settings({ mode: "interval", intervalM: 0.5 }), []).error).toContain("1m 以上");
  });
});

describe("initialSplitSettings", () => {
  it("今の区画の並びを再現する値になり、そのまま適用してもほとんど動かない", () => {
    const existing = [slot("a", 10), slot("b", 20), slot("c", 30), slot("x", 10, false, "right"), slot("y", 30, false, "right")];
    const initial = initialSplitSettings(100, existing);
    expect(initial).toMatchObject({ mode: "count", count: 3, sides: "both", startM: 5, endM: 35 });
    const plan = planRoadSlots(100, initial, existing);
    expect(plan.creates).toHaveLength(1); // 右側は2区画なので、3区画にそろえる分だけ作る
    expect(plan.moves).toEqual([]);
  });

  it("区画が無い道では道全体に10区画", () => {
    expect(initialSplitSettings(120.34, [])).toMatchObject({ count: 10, startM: 0, endM: 120.3, sides: "both" });
  });
});
