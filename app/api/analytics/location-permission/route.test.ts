import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
let collectionEnabled = true;

vi.mock("@/lib/analytics/collectionSettings.server", () => ({
  isAnalyticsCollectionEnabled: async () => collectionEnabled,
}));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/supabase/adminClient", () => ({ createAdminClient: () => ({ rpc }) }));

import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/analytics/location-permission", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  );
}

describe("POST /api/analytics/location-permission", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ error: null });
    collectionEnabled = true;
  });

  it("allowed / denied を 1 件増やす関数を呼ぶ", async () => {
    const allowed = await post({ choice: "allowed" });
    const denied = await post({ choice: "denied" });

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(200);
    expect(rpc).toHaveBeenNthCalledWith(1, "increment_location_permission_count", { p_choice: "allowed" });
    expect(rpc).toHaveBeenNthCalledWith(2, "increment_location_permission_count", { p_choice: "denied" });
  });

  it("想定外の値は 400 で、数えない", async () => {
    const res = await post({ choice: "granted", lat: 33.5, lng: 133.5 });
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("壊れた JSON は 400 で、数えない", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("収集を止めている設定のときは数えない", async () => {
    collectionEnabled = false;
    const res = await post({ choice: "allowed" });
    expect(await res.json()).toEqual({ ok: true, skipped: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("保存に失敗したら 500 を返す（呼び出し側は無視する）", async () => {
    rpc.mockResolvedValue({ error: { message: "boom" } });
    const res = await post({ choice: "allowed" });
    expect(res.status).toBe(500);
  });
});
