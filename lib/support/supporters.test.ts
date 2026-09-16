import { describe, it, expect } from "vitest";
import {
  assignSupporterColors,
  buildFundingSegments,
  buildSupporterSlots,
  OTHER_FUNDING_COLOR,
  SUPPORTER_COLORS,
  type Supporter,
} from "./supporters";

const MONTHLY = 10_000;

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

describe("buildFundingSegments", () => {
  it("協賛ごとに区切り、月数へ直す", () => {
    const segments = buildFundingSegments({
      supporters: [
        { name: "A", amountJpy: 30_000 },
        { name: "B", amountJpy: 20_000 },
      ],
      fundsJpy: 50_000,
      monthlyJpy: MONTHLY,
    });
    expect(segments.map((s) => [s.label, s.months])).toEqual([
      ["A", 3],
      ["B", 2],
    ]);
  });

  it("金額を出していない協賛のぶんは「その他」にまとめる", () => {
    const segments = buildFundingSegments({
      supporters: [{ name: "A", amountJpy: 30_000 }, { name: "B" }],
      fundsJpy: 50_000,
      monthlyJpy: MONTHLY,
    });
    expect(segments.map((s) => s.label)).toEqual(["A", "その他"]);
    expect(segments[1].amountJpy).toBe(20_000);
    expect(segments[1].color).toBe(OTHER_FUNDING_COLOR);
  });

  // 口座の実額（fundsJpy）が真なので、内訳の書き間違いでメーターが伸びてはいけない
  it("内訳の合計が手元の総額を超えたら、そこで切る", () => {
    const segments = buildFundingSegments({
      supporters: [
        { name: "A", amountJpy: 40_000 },
        { name: "B", amountJpy: 40_000 },
      ],
      fundsJpy: 50_000,
      monthlyJpy: MONTHLY,
    });
    expect(segments.reduce((sum, s) => sum + s.amountJpy, 0)).toBe(50_000);
    expect(segments.map((s) => s.amountJpy)).toEqual([40_000, 10_000]);
  });

  it("支援が無ければ塗らない", () => {
    expect(buildFundingSegments({ supporters: [], fundsJpy: 0, monthlyJpy: MONTHLY })).toEqual([]);
  });

  it("月額が 0 なら、割り算をせずに塗らない", () => {
    expect(
      buildFundingSegments({ supporters: [{ name: "A", amountJpy: 1 }], fundsJpy: 1, monthlyJpy: 0 })
    ).toEqual([]);
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
