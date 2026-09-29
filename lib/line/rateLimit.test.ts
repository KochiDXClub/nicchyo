import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkLineUserRateLimit,
  getLineRateLimitKey,
  isDuplicateLineEvent,
} from "./rateLimit";

// 共有レートリミッター（lib/security/rateLimit）の in-memory フォールバックはテスト間で
// リセットできないため、テストごとに別のキーを使う
const req = () => new Request("http://localhost/api/line/webhook", { method: "POST" });

describe("checkLineUserRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("短時間の送信が制限内（5回まで）なら許可される", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await checkLineUserRateLimit(req(), "user:U_test_1");
      expect(res.allowed).toBe(true);
    }
  });

  it("1分間に6回以上送信するとレートリミットでブロックされる", async () => {
    for (let i = 0; i < 5; i++) {
      await checkLineUserRateLimit(req(), "user:U_test_2");
    }
    const blocked = await checkLineUserRateLimit(req(), "user:U_test_2");
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toContain("1分ばあ待ってから");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("1分経過後は再びリクエストが許可される", async () => {
    for (let i = 0; i < 5; i++) {
      await checkLineUserRateLimit(req(), "user:U_test_3");
    }
    expect((await checkLineUserRateLimit(req(), "user:U_test_3")).allowed).toBe(false);

    vi.advanceTimersByTime(65 * 1000);
    expect((await checkLineUserRateLimit(req(), "user:U_test_3")).allowed).toBe(true);
  });

  it("10分間に26回以上送信すると継続利用制限でブロックされる", async () => {
    for (let i = 0; i < 25; i++) {
      expect((await checkLineUserRateLimit(req(), "user:U_test_long")).allowed).toBe(true);
      // 1分あたり5回の制限にかからない間隔で送る
      vi.advanceTimersByTime(13 * 1000);
    }
    const blocked = await checkLineUserRateLimit(req(), "user:U_test_long");
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toContain("少し時間をおいてから");
  });

  it("異なるキー同士はお互いに影響しない", async () => {
    for (let i = 0; i < 5; i++) {
      await checkLineUserRateLimit(req(), "user:U_A");
    }
    expect((await checkLineUserRateLimit(req(), "user:U_A")).allowed).toBe(false);
    expect((await checkLineUserRateLimit(req(), "user:U_B")).allowed).toBe(true);
  });
});

describe("getLineRateLimitKey", () => {
  it("userId があればユーザー単位のキーになる", () => {
    expect(getLineRateLimitKey({ type: "user", userId: "U1" })).toBe("user:U1");
    expect(getLineRateLimitKey({ type: "group", groupId: "C1", userId: "U2" })).toBe("user:U2");
  });

  it("userId が取れないグループ/トークルームは groupId/roomId 単位のキーになる", () => {
    expect(getLineRateLimitKey({ type: "group", groupId: "C1" })).toBe("group:C1");
    expect(getLineRateLimitKey({ type: "room", roomId: "R1" })).toBe("room:R1");
  });

  it("送信元が無い場合も共通キーで数え、制限をすり抜けない", () => {
    expect(getLineRateLimitKey(undefined)).toBe("unknown");
  });
});

describe("isDuplicateLineEvent", () => {
  it("同じ webhookEventId の2回目以降を重複として検出する", async () => {
    expect(await isDuplicateLineEvent(req(), "evt_dup_1")).toBe(false);
    expect(await isDuplicateLineEvent(req(), "evt_dup_1")).toBe(true);
    expect(await isDuplicateLineEvent(req(), "evt_dup_2")).toBe(false);
  });

  it("webhookEventId が無い場合は重複扱いしない", async () => {
    expect(await isDuplicateLineEvent(req(), undefined)).toBe(false);
    expect(await isDuplicateLineEvent(req(), undefined)).toBe(false);
  });
});
