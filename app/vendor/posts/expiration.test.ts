import { describe, expect, it } from "vitest";
import { calcExpiresAt, formatExpiresAt, localDateTimeInputValue } from "./expiration";

const NOW = new Date(2026, 9, 1, 10, 0); // 2026/10/1（木）10:00

describe("calcExpiresAt", () => {
  it("1時間だけは、いまから1時間後", () => {
    expect(calcExpiresAt("1h", "", NOW)?.getTime()).toBe(NOW.getTime() + 60 * 60 * 1000);
  });

  it("時間を決めるのに日時が無い・過ぎているときは null（黙って別の時刻にしない）", () => {
    expect(calcExpiresAt("custom", "", NOW)).toBeNull();
    expect(calcExpiresAt("custom", "2026-10-01T09:00", NOW)).toBeNull();
    expect(calcExpiresAt("custom", "2026-10-01T15:30", NOW)).toEqual(new Date(2026, 9, 1, 15, 30));
  });
});

describe("formatExpiresAt", () => {
  it("決めた時間は、今日なら「今日 15:30まで」、別の日なら日付をつける", () => {
    expect(formatExpiresAt("custom", new Date(2026, 9, 1, 15, 30), NOW)).toBe("今日 15:30まで");
    expect(formatExpiresAt("custom", new Date(2026, 9, 3, 9, 5), NOW)).toBe("10/3 9:05まで");
  });

  it("日曜までは「10/4（日）まで」", () => {
    expect(formatExpiresAt("sunday", new Date(2026, 9, 4, 23, 59), NOW)).toBe("10/4（日）まで");
  });
});

describe("localDateTimeInputValue", () => {
  it("端末の時刻のまま datetime-local の形にする（UTC にずらさない）", () => {
    expect(localDateTimeInputValue(new Date(2026, 0, 2, 3, 4))).toBe("2026-01-02T03:04");
  });
});
