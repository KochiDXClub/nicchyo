import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
const updateUserById = vi.fn();
const insertLog = vi.fn();
let sameOrigin = true;

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/security/requestGuards", () => ({
  requireSameOrigin: () =>
    sameOrigin ? { ok: true } : { ok: false, response: new Response(null, { status: 403 }) },
}));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => ({ auth: { getUser: () => getUser() } }) }));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => rpc(...args),
    auth: { admin: { updateUserById: (...args: unknown[]) => updateUserById(...args) } },
    from: () => ({ insert: (row: unknown) => insertLog(row) }),
  }),
}));

import { POST } from "./route";

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";

function claim(token: unknown = TOKEN) {
  return POST(
    new Request("https://nicchyo.example/api/vendor/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }),
  );
}
const status = (s: string, vendorId: string | null = null) => ({ data: [{ status: s, vendor_id: vendorId }], error: null });

beforeEach(() => {
  vi.clearAllMocks();
  sameOrigin = true;
  getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: { role: "general_user" }, user_metadata: { name: "山田" } } } });
  rpc.mockResolvedValue(status("ok", "shop-1"));
  updateUserById.mockResolvedValue({ error: null });
  insertLog.mockResolvedValue({ error: null });
});

describe("POST /api/vendor/claim", () => {
  it("QRで紐づけたら、出店者ロールを付けて操作ログを残す。DB にはトークンのハッシュだけを渡す", async () => {
    const res = await claim();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, vendorId: "shop-1" });
    const args = rpc.mock.calls[0];
    expect(args[0]).toBe("claim_shop_with_token");
    expect((args[1] as { p_token_hash: string }).p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain(TOKEN);
    expect(updateUserById).toHaveBeenCalledWith("user-1", { app_metadata: { role: "vendor" } });
    expect(insertLog.mock.calls[0][0]).toMatchObject({ vendor_id: "shop-1", action: "qr.link" });
  });

  it("ログインしていなければ 401（DB には問い合わせない）", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect((await claim()).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("形のおかしいトークンは DB に行かず 404", async () => {
    expect((await claim("short")).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("使えないQR・すでに代表者がいる・別の店舗にいるときは断り、ロールは付けない", async () => {
    for (const [s, code] of [["invalid", 404], ["already_claimed", 409], ["already_member", 409]] as const) {
      rpc.mockResolvedValueOnce(status(s));
      const res = await claim();
      expect(res.status).toBe(code);
      expect((await res.json()).code).toBe(s);
    }
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("運営ロールは出店者に下げない", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin-1", app_metadata: { role: "admin" }, user_metadata: {} } } });

    expect((await claim()).status).toBe(200);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("ロールの付与に失敗したら 500 と専用のコードを返す（QR は使用済みなので、画面でログインし直してもらう）", async () => {
    updateUserById.mockResolvedValue({ error: { message: "boom" } });

    const res = await claim();

    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe("role_failed");
  });

  it("別のオリジンからは受け付けない", async () => {
    sameOrigin = false;

    expect((await claim()).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
