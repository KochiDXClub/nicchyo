import { describe, it, expect } from "vitest";
import { FUND_USES, formatJpy } from "./costs";

describe("formatJpy", () => {
  it("桁区切りを付け、1円未満は四捨五入する", () => {
    expect(formatJpy(30_000)).toBe("30,000円");
    expect(formatJpy(1_234.5)).toBe("1,235円");
  });
});

describe("ご支援の使い道", () => {
  it("1つ以上ある", () => {
    expect(FUND_USES.length).toBeGreaterThan(0);
  });

  // 運営にいくらかかるかは出さない方針。使い道の説明に金額が紛れ込まないようにする
  it("説明に金額を書いていない", () => {
    for (const use of FUND_USES) {
      expect(`${use.title}${use.body}`).not.toMatch(/\d[\d,]*\s*円|\$\s*\d|ヶ月分/);
    }
  });
});
