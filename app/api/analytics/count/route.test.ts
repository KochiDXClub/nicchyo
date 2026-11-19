import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// 守りが呼ばれた順番を記録する
const calls: string[] = [];

const sameOrigin = vi.fn();
vi.mock("@/lib/security/requestGuards", () => ({
  requireSameOrigin: () => {
    calls.push("origin");
    return sameOrigin();
  },
}));
const rateLimit = vi.fn();
vi.mock("@/lib/security/rateLimit", () => ({
  enforceRateLimit: (_request: Request, options: unknown) => {
    calls.push("rateLimit");
    return rateLimit(options);
  },
}));
const isEnabled = vi.fn();
vi.mock("@/lib/analytics/collectionSettings.server", () => ({
  isAnalyticsCollectionEnabled: (key: string) => {
    calls.push(`toggle:${key}`);
    return isEnabled(key);
  },
}));
const rpc = vi.fn();
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => {
    calls.push("admin");
    return { rpc };
  },
}));

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/analytics/count", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/analytics/count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls.length = 0;
    sameOrigin.mockReturnValue({ ok: true });
    rateLimit.mockResolvedValue(null);
    isEnabled.mockResolvedValue(true);
    rpc.mockResolvedValue({ error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("同一オリジン → レート制限 → 検証 → 取得設定 → 数える の順に通り、機能の利用を 1 件数える", async () => {
    const res = await post({ kind: "usage", feature: "consult" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls).toEqual(["origin", "rateLimit", "toggle:featureUsage", "admin"]);
    expect(rateLimit).toHaveBeenCalledWith(expect.objectContaining({ bucket: "analytics-count" }));
    expect(rpc).toHaveBeenCalledWith("increment_usage_daily", { p_feature: "consult" });
  });

  it("別オリジンなら、レート制限にも数える処理にも進まない", async () => {
    sameOrigin.mockReturnValue({ ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) });
    expect((await post({ kind: "usage", feature: "map" })).status).toBe(403);
    expect(calls).toEqual(["origin"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("レート制限に掛かったら、取得設定も読まず数えない", async () => {
    rateLimit.mockResolvedValue(NextResponse.json({ error: "Too many" }, { status: 429 }));
    expect((await post({ kind: "usage", feature: "map" })).status).toBe(429);
    expect(calls).toEqual(["origin", "rateLimit"]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("不正な body は 400 で、数えない", async () => {
    for (const body of [{ kind: "usage", feature: "admin" }, { kind: "other" }, "not json", [1]]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(isEnabled).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("取得設定を止めている（トグル OFF）ときは数えない", async () => {
    isEnabled.mockResolvedValue(false);
    const res = await post({ kind: "usage", feature: "map" });
    expect(await res.json()).toEqual({ ok: true, skipped: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("RPC がエラーを返しても、例外を投げても、来訪者には 200", async () => {
    rpc.mockResolvedValueOnce({ error: { message: "boom" } });
    const res = await post({ kind: "usage", feature: "shop" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    rpc.mockRejectedValueOnce(new Error("network"));
    expect((await post({ kind: "usage", feature: "shop" })).status).toBe(200);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
