import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const insertRead = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: () => getUser() } }),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({ from: () => ({ insert: (row: unknown) => insertRead(row) }) }),
}));

import { POST } from "./route";

const NOTICE_ID = "6f1c2a3e-1b2c-4d5e-8f90-1234567890ab";

function confirm(id = NOTICE_ID) {
  return POST(new Request(`http://localhost/api/vendor/notices/${id}/read`, { method: "POST" }), {
    params: Promise.resolve({ id }),
  });
}

describe("POST /api/vendor/notices/[id]/read", () => {
  beforeEach(() => {
    getUser.mockReset();
    insertRead.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "vendor-1", app_metadata: { role: "vendor" } } } });
    insertRead.mockResolvedValue({ error: null });
  });

  it("ログインした出店者として「確認しました」を記録する（出店者は自分のものとしてしか記録できない）", async () => {
    const res = await confirm();
    expect(res.status).toBe(200);
    expect(insertRead).toHaveBeenCalledWith({ notice_id: NOTICE_ID, vendor_id: "vendor-1" });
  });

  it("出店者でなければ記録しない", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u", app_metadata: { role: "general_user" } } } });
    expect((await confirm()).status).toBe(403);
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await confirm()).status).toBe(401);
    expect(insertRead).not.toHaveBeenCalled();
  });

  it("2回目はそのまま成功、取り下げられたお知らせは 404、おかしな id は DB に行かない", async () => {
    insertRead.mockResolvedValue({ error: { code: "23505" } });
    expect((await confirm()).status).toBe(200);
    insertRead.mockResolvedValue({ error: { code: "23503" } });
    expect((await confirm()).status).toBe(404);
    insertRead.mockClear();
    expect((await confirm("not-a-uuid")).status).toBe(404);
    expect(insertRead).not.toHaveBeenCalled();
  });
});
