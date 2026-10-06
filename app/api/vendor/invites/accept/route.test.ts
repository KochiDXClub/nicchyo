import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
const updateUserById = vi.fn();
const maybeSingleByTable: Record<string, ReturnType<typeof vi.fn<() => Promise<unknown>>>> = {
  shop_invites: vi.fn<() => Promise<unknown>>(),
  shop_members: vi.fn<() => Promise<unknown>>(),
};
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
    from: (table: string) =>
      table === "vendor_activity_logs"
        ? { insert: (row: unknown) => insertLog(row) }
        : { select: () => ({ eq: () => ({ maybeSingle: () => maybeSingleByTable[table]() }) }) },
  }),
}));

import { POST } from "./route";

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";

function accept(token: unknown = TOKEN) {
  return POST(
    new Request("https://nicchyo.example/api/vendor/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    }),
  );
}
const ok = { data: [{ status: "ok", vendor_id: "shop-1", permissions: ["post"] }], error: null };
const status = (s: string) => ({ data: [{ status: s, vendor_id: null, permissions: null }], error: null });

beforeEach(() => {
  vi.clearAllMocks();
  sameOrigin = true;
  getUser.mockResolvedValue({ data: { user: { id: "user-1", app_metadata: { role: "general_user" }, user_metadata: {} } } });
  rpc.mockResolvedValue(ok);
  updateUserById.mockResolvedValue({ error: null });
  insertLog.mockResolvedValue({ error: null });
});

describe("POST /api/vendor/invites/accept", () => {
  it("参加できたら出店者ロールを付け、操作ログを残す。DB にはトークンのハッシュを渡す", async () => {
    const res = await accept();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, vendorId: "shop-1", joinedNow: true });
    const args = rpc.mock.calls[0];
    expect(args[0]).toBe("accept_shop_invite");
    expect(args[1]).toMatchObject({ p_user_id: "user-1" });
    expect((args[1] as { p_token_hash: string }).p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(args)).not.toContain(TOKEN);
    expect(updateUserById).toHaveBeenCalledWith("user-1", { app_metadata: { role: "vendor" } });
    expect(insertLog.mock.calls[0][0]).toMatchObject({ vendor_id: "shop-1", actor_id: "user-1", action: "member.join" });
  });

  it("運営ロールは出店者に下げない", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "admin-1", app_metadata: { role: "admin" }, user_metadata: {} } } });

    expect((await accept()).status).toBe(200);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("ログインしていなければ 401（DB には問い合わせない）", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect((await accept()).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("形のおかしいトークンは DB に行かず 404", async () => {
    expect((await accept("short")).status).toBe(404);
    expect((await accept("../../etc/passwd")).status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("使えないリンクは状態ごとの状態コードと文言で断り、ロールは付けない", async () => {
    for (const [s, code] of [["invalid", 404], ["expired", 410], ["full", 409]] as const) {
      rpc.mockResolvedValueOnce(status(s));
      const res = await accept();
      expect(res.status).toBe(code);
      expect((await res.json()).code).toBe(s);
    }
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("別の店舗にすでに入っているなら 409", async () => {
    rpc.mockResolvedValue(status("already_member"));
    maybeSingleByTable.shop_invites.mockResolvedValue({ data: { vendor_id: "shop-1" } });
    maybeSingleByTable.shop_members.mockResolvedValue({ data: { vendor_id: "shop-2" } });

    const res = await accept();

    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("already_member");
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("同じ店舗の招待を押し直したときは成功にして、ロールの付与だけやり直す（ログは重ねない）", async () => {
    rpc.mockResolvedValue(status("already_member"));
    maybeSingleByTable.shop_invites.mockResolvedValue({ data: { vendor_id: "shop-1" } });
    maybeSingleByTable.shop_members.mockResolvedValue({ data: { vendor_id: "shop-1" } });

    const res = await accept();

    expect(await res.json()).toEqual({ ok: true, vendorId: "shop-1", joinedNow: false });
    expect(updateUserById).toHaveBeenCalledTimes(1);
    expect(insertLog).not.toHaveBeenCalled();
  });

  it("ロールの付与に失敗したら 500（押し直せば完了する）", async () => {
    updateUserById.mockResolvedValue({ error: { message: "boom" } });

    expect((await accept()).status).toBe(500);
  });

  it("別のオリジンからは受け付けない", async () => {
    sameOrigin = false;

    expect((await accept()).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
