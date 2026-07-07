import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getNextSundayExpiry, getNextSundayLabel } from "./date";

describe("getNextSundayExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("日曜日に呼ばれた場合は当日の23:59:59.999を返す", () => {
    // 2026-07-05 は日曜日（10:00）
    vi.setSystemTime(new Date(2026, 6, 5, 10, 0, 0));
    const expiry = getNextSundayExpiry();
    expect(expiry.getFullYear()).toBe(2026);
    expect(expiry.getMonth()).toBe(6); // 7月
    expect(expiry.getDate()).toBe(5); // 当日
    expect(expiry.getHours()).toBe(23);
    expect(expiry.getMinutes()).toBe(59);
    expect(expiry.getSeconds()).toBe(59);
    expect(expiry.getMilliseconds()).toBe(999);
  });

  it("平日（水曜）に呼ばれた場合は次の日曜を返す", () => {
    // 2026-07-01 は水曜日
    vi.setSystemTime(new Date(2026, 6, 1, 12, 0, 0));
    const expiry = getNextSundayExpiry();
    expect(expiry.getDate()).toBe(5); // 次の日曜（7/5）
    expect(expiry.getDay()).toBe(0);
    expect(expiry.getHours()).toBe(23);
  });

  it("土曜に呼ばれた場合は翌日の日曜を返す", () => {
    // 2026-07-04 は土曜日
    vi.setSystemTime(new Date(2026, 6, 4, 20, 0, 0));
    const expiry = getNextSundayExpiry();
    expect(expiry.getDate()).toBe(5); // 翌日（7/5）
    expect(expiry.getDay()).toBe(0);
  });

  it("月末をまたぐ場合も正しく次の日曜を返す", () => {
    // 2026-06-30 は火曜日 → 次の日曜は 2026-07-05
    vi.setSystemTime(new Date(2026, 5, 30, 9, 0, 0));
    const expiry = getNextSundayExpiry();
    expect(expiry.getMonth()).toBe(6); // 7月
    expect(expiry.getDate()).toBe(5);
    expect(expiry.getDay()).toBe(0);
  });
});

describe("getNextSundayLabel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("平日は次の日曜の M/D（日）ラベルを返す", () => {
    vi.setSystemTime(new Date(2026, 6, 1, 12, 0, 0)); // 水曜
    expect(getNextSundayLabel()).toBe("7/5（日）");
  });

  it("日曜は当日のラベルを返す", () => {
    vi.setSystemTime(new Date(2026, 6, 5, 10, 0, 0)); // 日曜
    expect(getNextSundayLabel()).toBe("7/5（日）");
  });
});
