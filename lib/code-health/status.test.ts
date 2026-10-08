import { describe, expect, it } from "vitest";
import { statusOf } from "./status";

describe("statusOf", () => {
  it("lower 指標が目標以下なら good", () => {
    expect(statusOf({ better: "lower", target: 10 }, 5)).toBe("good");
    expect(statusOf({ better: "lower", target: 10 }, 10)).toBe("good");
  });

  it("lower 指標が目標の2倍を超えたら critical、それ以外は warning", () => {
    expect(statusOf({ better: "lower", target: 10 }, 15)).toBe("warning");
    expect(statusOf({ better: "lower", target: 10 }, 21)).toBe("critical");
  });

  it("higher 指標が目標以上なら good", () => {
    expect(statusOf({ better: "higher", target: 30 }, 30)).toBe("good");
    expect(statusOf({ better: "higher", target: 30 }, 50)).toBe("good");
  });

  it("higher 指標が目標の半分未満なら critical、それ以外は warning", () => {
    expect(statusOf({ better: "higher", target: 30 }, 20)).toBe("warning");
    expect(statusOf({ better: "higher", target: 30 }, 14)).toBe("critical");
  });
});
