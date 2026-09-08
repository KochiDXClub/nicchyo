import { describe, it, expect } from "vitest";
import {
  annualCostJpy,
  hasPendingCost,
  monthlyCostJpy,
  monthlyOf,
  runwayMonths,
  sponsorUnitMonths,
  type RunningCost,
} from "./costs";

function cost(partial: Partial<RunningCost>): RunningCost {
  return {
    label: "テスト",
    purpose: "用途",
    stopsWhat: "止まると困ります",
    amountJpy: null,
    cycle: "monthly",
    ...partial,
  };
}

describe("monthlyOf", () => {
  it("年払いは12で割る", () => {
    expect(monthlyOf(cost({ amountJpy: 7_000, cycle: "annual" }))).toBeCloseTo(583.33, 1);
  });

  it("月払いはそのまま", () => {
    expect(monthlyOf(cost({ amountJpy: 3_000, cycle: "monthly" }))).toBe(3_000);
  });

  it("未確定なら null", () => {
    expect(monthlyOf(cost({ amountJpy: null }))).toBeNull();
  });
});

describe("monthlyCostJpy / annualCostJpy", () => {
  const costs = [
    cost({ amountJpy: 3_000, cycle: "monthly" }),
    cost({ amountJpy: 7_000, cycle: "annual" }),
  ];

  it("月払いと年払いを月額でそろえて足す", () => {
    expect(monthlyCostJpy(costs)).toBeCloseTo(3_583.33, 1);
  });

  it("年額は月額の12倍。年払いのぶんは元の年額に戻る", () => {
    expect(annualCostJpy(costs)).toBeCloseTo(43_000, 5);
  });

  it("未確定の費目は 0 として足す", () => {
    expect(monthlyCostJpy([...costs, cost({ amountJpy: null })])).toBeCloseTo(3_583.33, 1);
  });
});

describe("hasPendingCost", () => {
  // 未確定があるあいだは合計が実際より少なく出るので、呼び出し側が「以上」を添える
  it("未確定の費目が1つでもあれば true", () => {
    expect(hasPendingCost([cost({ amountJpy: 3_000 }), cost({ amountJpy: null })])).toBe(true);
  });

  it("すべて埋まっていれば false", () => {
    expect(hasPendingCost([cost({ amountJpy: 3_000 })])).toBe(false);
  });
});

describe("runwayMonths", () => {
  it("手元の額を月額で割る", () => {
    expect(runwayMonths(30_000, 10_000)).toBe(3);
  });

  it("月額が 0 なら割り算をしない", () => {
    expect(runwayMonths(30_000, 0)).toBe(0);
  });
});

describe("sponsorUnitMonths", () => {
  it("1口が何ヶ月ぶんにあたるかを出す", () => {
    expect(sponsorUnitMonths(50_000, 10_000)).toBe(5);
  });

  it("金額未定なら null", () => {
    expect(sponsorUnitMonths(null, 10_000)).toBeNull();
  });
});
