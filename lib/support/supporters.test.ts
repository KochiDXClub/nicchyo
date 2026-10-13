import { describe, it, expect } from "vitest";
import {
  assignSupporterColors,
  buildSupporterSlots,
  SUPPORTER_COLORS,
  type Supporter,
} from "./supporters";

describe("assignSupporterColors", () => {
  it("金額を出している協賛にだけ、並び順どおりに色を割り当てる", () => {
    const supporters: Supporter[] = [
      { name: "A", amountJpy: 1 },
      { name: "B" },
      { name: "C", amountJpy: 1 },
    ];
    expect(assignSupporterColors(supporters)).toEqual([
      SUPPORTER_COLORS[0],
      null,
      SUPPORTER_COLORS[1],
    ]);
  });
});

describe("buildSupporterSlots", () => {
  it("埋まっている枠を先に、残りを空き枠で埋める", () => {
    const slots = buildSupporterSlots([{ name: "A" }], 3);
    expect(slots).toEqual([{ name: "A" }, null, null]);
  });

  it("枠数より協賛が多ければ、空き枠は出さない", () => {
    const slots = buildSupporterSlots([{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }], 3);
    expect(slots).toHaveLength(4);
    expect(slots.every(Boolean)).toBe(true);
  });
});
