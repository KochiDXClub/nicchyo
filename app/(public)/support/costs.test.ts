import { describe, it, expect } from "vitest";
import {
  RUNNING_COSTS,
  USD_JPY,
  annualCostJpy,
  costPerVisitorJpy,
  formatPerVisitorJpy,
  formatUsd,
  hasPendingCost,
  monthlyCostJpy,
  monthlyJpyOf,
  runwayMonths,
  sponsorUnitMonths,
  toJpy,
  type RunningCost,
} from "./costs";

const RATE = 150;

function cost(partial: Partial<RunningCost>): RunningCost {
  return {
    label: "テスト",
    purpose: "用途",
    stopsWhat: "止まると困ります",
    amount: null,
    currency: "USD",
    cycle: "monthly",
    ...partial,
  };
}

describe("toJpy", () => {
  it("ドル建てはレートを掛ける", () => {
    expect(toJpy(20, "USD", RATE)).toBe(3_000);
  });

  it("円建てはレートを掛けない", () => {
    expect(toJpy(7_000, "JPY", RATE)).toBe(7_000);
  });
});

describe("monthlyJpyOf", () => {
  it("ドルの月払いは円に直すだけ", () => {
    expect(monthlyJpyOf(cost({ amount: 25, currency: "USD" }), RATE)).toBe(3_750);
  });

  it("円の年払いは12で割る", () => {
    expect(
      monthlyJpyOf(cost({ amount: 7_000, currency: "JPY", cycle: "annual" }), RATE)
    ).toBeCloseTo(583.33, 1);
  });

  it("ドルの年払いは円に直してから12で割る", () => {
    expect(
      monthlyJpyOf(cost({ amount: 120, currency: "USD", cycle: "annual" }), RATE)
    ).toBe(1_500);
  });

  it("未確定なら null", () => {
    expect(monthlyJpyOf(cost({ amount: null }), RATE)).toBeNull();
  });
});

describe("monthlyCostJpy / annualCostJpy", () => {
  const costs = [
    cost({ amount: 20, currency: "USD" }),
    cost({ amount: 7_000, currency: "JPY", cycle: "annual" }),
  ];

  it("通貨と周期をそろえて足す", () => {
    expect(monthlyCostJpy(costs, RATE)).toBeCloseTo(3_583.33, 1);
  });

  it("年額は月額の12倍。年払いのぶんは元の年額に戻る", () => {
    expect(annualCostJpy(costs, RATE)).toBeCloseTo(43_000, 5);
  });

  it("未確定の費目は 0 として足す", () => {
    expect(monthlyCostJpy([...costs, cost({ amount: null })], RATE)).toBeCloseTo(3_583.33, 1);
  });

  // レートが動けば請求も動く。固定額として持っていないことの確認
  it("レートが上がれば合計も上がる", () => {
    expect(monthlyCostJpy(costs, 160)).toBeGreaterThan(monthlyCostJpy(costs, 150));
  });
});

describe("hasPendingCost", () => {
  // 未確定があるあいだは合計が実際より少なく出るので、呼び出し側が「以上」を添える
  it("未確定の費目が1つでもあれば true", () => {
    expect(hasPendingCost([cost({ amount: 20 }), cost({ amount: null })])).toBe(true);
  });

  it("すべて埋まっていれば false", () => {
    expect(hasPendingCost([cost({ amount: 20 })])).toBe(false);
  });
});

describe("formatUsd", () => {
  it("整数はそのまま、端数は2桁でそろえる", () => {
    expect(formatUsd(20)).toBe("$20");
    expect(formatUsd(6.5)).toBe("$6.50");
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

describe("costPerVisitorJpy", () => {
  it("月額を人数で割る", () => {
    expect(costPerVisitorJpy(10_000, 3_000)).toBeCloseTo(3.33, 2);
  });

  // 固定費なので、人数が増えるほど1人あたりは下がる。この節の主張そのもの
  it("人数が増えるほど1人あたりは下がる", () => {
    expect(costPerVisitorJpy(10_000, 20_000)!).toBeLessThan(costPerVisitorJpy(10_000, 1_000)!);
  });

  it("人数が 0 なら割らずに null", () => {
    expect(costPerVisitorJpy(10_000, 0)).toBeNull();
  });

  it("月額が 0 なら null", () => {
    expect(costPerVisitorJpy(0, 3_000)).toBeNull();
  });
});

describe("formatPerVisitorJpy", () => {
  // 1円を切ることがあるので、整数に丸めると 0円 になってしまう
  it("小数第1位まで出す", () => {
    expect(formatPerVisitorJpy(3.3333)).toBe("3.3円");
    expect(formatPerVisitorJpy(0.502)).toBe("0.5円");
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

describe("実際に載せている費目", () => {
  // レートを画面に出す以上、基準日が読める形でないと意味がない
  it("為替の基準日が日付として解釈できる", () => {
    expect(Number.isNaN(new Date(USD_JPY.asOf).getTime())).toBe(false);
  });

  it("すべての費目に金額が入っている", () => {
    expect(hasPendingCost(RUNNING_COSTS)).toBe(false);
  });

  it("ドル建ての費目は円に換算されて合計に入る", () => {
    // 円建てはドメイン（年7,000円）だけなので、合計はレートに応じて動く
    expect(monthlyCostJpy(RUNNING_COSTS, 160)).toBeGreaterThan(
      monthlyCostJpy(RUNNING_COSTS, 150)
    );
  });
});
