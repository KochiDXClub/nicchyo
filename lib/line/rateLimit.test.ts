import { describe, it, expect, beforeEach } from "vitest";
import {
  checkLineUserRateLimit,
  _resetLineRateLimitStore,
} from "./rateLimit";

describe("checkLineUserRateLimit", () => {
  beforeEach(() => {
    _resetLineRateLimitStore();
  });

  it("短時間の送信が制限内（5回まで）なら許可される", () => {
    const userId = "U_user_test_1";
    const now = 1000000;

    for (let i = 0; i < 5; i++) {
      const res = checkLineUserRateLimit(userId, now + i * 1000);
      expect(res.allowed).toBe(true);
    }
  });

  it("1分間に6回以上送信するとレートリミットでブロックされる", () => {
    const userId = "U_user_test_2";
    const now = 1000000;

    // 5回送信
    for (let i = 0; i < 5; i++) {
      checkLineUserRateLimit(userId, now + i * 1000);
    }

    // 6回目（1分以内）
    const blocked = checkLineUserRateLimit(userId, now + 10 * 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.message).toContain("1分ばあ待ってから");
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("1分経過後は再びリクエストが許可される", () => {
    const userId = "U_user_test_3";
    const now = 1000000;

    // 5回送信してブロック状態にする
    for (let i = 0; i < 5; i++) {
      checkLineUserRateLimit(userId, now + i * 1000);
    }
    expect(checkLineUserRateLimit(userId, now + 10 * 1000).allowed).toBe(false);

    // 65秒後
    const afterCooldown = checkLineUserRateLimit(userId, now + 65 * 1000);
    expect(afterCooldown.allowed).toBe(true);
  });

  it("異なるユーザー同士はお互いに影響しない", () => {
    const userA = "U_user_A";
    const userB = "U_user_B";
    const now = 1000000;

    // userA をブロック状態にする
    for (let i = 0; i < 5; i++) {
      checkLineUserRateLimit(userA, now + i * 1000);
    }
    expect(checkLineUserRateLimit(userA, now + 10 * 1000).allowed).toBe(false);

    // userB はまだ送信していないので許可される
    expect(checkLineUserRateLimit(userB, now + 10 * 1000).allowed).toBe(true);
  });

  it("userId が undefined の場合は通過させる", () => {
    expect(checkLineUserRateLimit(undefined).allowed).toBe(true);
    expect(checkLineUserRateLimit(null).allowed).toBe(true);
  });
});
