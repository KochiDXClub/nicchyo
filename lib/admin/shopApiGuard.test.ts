import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const enforceRateLimit = vi.fn();

vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: () => requireAdminApi() }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({
  enforceRateLimit: (...args: unknown[]) => enforceRateLimit(...args),
  getClientIp: () => "203.0.113.5",
}));

import { guardAdminShopWrite } from "./shopApiGuard";

const ID = "00000000-0000-4000-8000-00000000000a";
const request = () => new Request("https://nicchyo.example/api/admin/shops/x", { method: "POST", body: JSON.stringify({ a: 1 }) });
const params = Promise.resolve({ id: ID });

beforeEach(() => {
  vi.clearAllMocks();
  requireAdminApi.mockResolvedValue({ user: { id: "admin-1" }, role: "admin", adminClient: {} });
  enforceRateLimit.mockResolvedValue(null);
});

describe("guardAdminShopWrite", () => {
  it("認可を先に通し、回数は IP ではなく管理者ごとに数える（現地の共有 IP で 429 にならないように）", async () => {
    await guardAdminShopWrite(request(), params, { bucket: "b", limit: 120 });
    expect(enforceRateLimit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ bucket: "b", limit: 120, identity: "admin-1" }));
  });

  it("管理者でなければ、回数を数える前に断る", async () => {
    requireAdminApi.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    const result = await guardAdminShopWrite(request(), params, { bucket: "b", limit: 1 });
    expect("error" in result && result.error.status).toBe(401);
    expect(enforceRateLimit).not.toHaveBeenCalled();
  });

  it("回数の上限に達したら、そのレスポンスを返す", async () => {
    enforceRateLimit.mockResolvedValue(new Response(null, { status: 429 }));
    const result = await guardAdminShopWrite(request(), params, { bucket: "b", limit: 1 });
    expect("error" in result && result.error.status).toBe(429);
  });

  it("店舗 ID が UUID でなければ 400。json: true なら本文を読み、IP を監査ログ用に返す", async () => {
    const bad = await guardAdminShopWrite(request(), Promise.resolve({ id: "x" }), { bucket: "b", limit: 1 });
    expect("error" in bad && bad.error.status).toBe(400);

    const ok = await guardAdminShopWrite(request(), params, { bucket: "b", limit: 1, json: true });
    expect("ctx" in ok && ok.ctx.id).toBe(ID);
    expect("ctx" in ok && ok.ctx.ip).toBe("203.0.113.5");
    expect("ctx" in ok && ok.body).toEqual({ a: 1 });
  });
});
