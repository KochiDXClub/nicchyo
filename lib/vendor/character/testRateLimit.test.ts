import { describe, expect, it } from "vitest";
import {
  consumeTest,
  EMPTY_USAGE,
  msUntilNextTest,
  remainingTests,
  TEST_LIMIT,
  TEST_WINDOW_MS,
  type TestUsage,
} from "./testRateLimit";

function fill(count: number, at: number): TestUsage {
  return { timestamps: Array.from({ length: count }, () => at) };
}

describe("話し方テストの回数制限（10分100回）", () => {
  it("使うたびに残りが減る", () => {
    const first = consumeTest(EMPTY_USAGE, 0);
    expect(first.ok).toBe(true);
    expect(remainingTests(first.usage, 0)).toBe(TEST_LIMIT - 1);
  });

  it("100回使うと、101回目は断られる", () => {
    const full = fill(TEST_LIMIT, 1000);
    const result = consumeTest(full, 2000);
    expect(result.ok).toBe(false);
    expect(remainingTests(result.usage, 2000)).toBe(0);
  });

  it("10分たった分から使えるようになる", () => {
    const full = fill(TEST_LIMIT, 0);
    expect(msUntilNextTest(full, 1000)).toBe(TEST_WINDOW_MS - 1000);
    expect(consumeTest(full, TEST_WINDOW_MS).ok).toBe(true);
  });

  it("上限に達していなければ待ち時間は0", () => {
    expect(msUntilNextTest(fill(TEST_LIMIT - 1, 0), 10)).toBe(0);
  });
});
