import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const insert = vi.fn();
const limit = vi.fn();

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: () => getUser() } }),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    from: () => ({
      insert: (row: unknown) => insert(row),
      select: () => ({ order: () => ({ limit: (n: number) => limit(n) }) }),
    }),
  }),
}));

import { GET, POST } from "./route";

const asRole = (role: string) =>
  getUser.mockResolvedValue({ data: { user: { id: "u1", email: "a@example.com", app_metadata: { role } } } });

function post(body: string) {
  return POST(
    new Request("http://localhost/api/admin/audit-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
  );
}

describe("/api/admin/audit-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    limit.mockResolvedValue({ data: [], count: 0, error: null });
  });

  it("moderator は監査ログを読めない（RLS と同じく admin だけ）", async () => {
    asRole("moderator");
    const res = await GET(new Request("http://localhost/api/admin/audit-logs"));
    expect(res.status).toBe(403);
    expect(limit).not.toHaveBeenCalled();
  });

  it("moderator は監査ログを書けない", async () => {
    asRole("moderator");
    const res = await post(JSON.stringify({ action: "x" }));
    expect(res.status).toBe(403);
    expect(insert).not.toHaveBeenCalled();
  });

  it("admin は読める。limit は 1〜1000 に丸める", async () => {
    asRole("admin");
    expect((await GET(new Request("http://localhost/api/admin/audit-logs?limit=-5"))).status).toBe(200);
    expect(limit).toHaveBeenLastCalledWith(1);
    await GET(new Request("http://localhost/api/admin/audit-logs?limit=99999"));
    expect(limit).toHaveBeenLastCalledWith(1000);
  });

  it("admin でも壊れた JSON は 400 で返す", async () => {
    asRole("admin");
    const res = await post("{");
    expect(res.status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });
});
