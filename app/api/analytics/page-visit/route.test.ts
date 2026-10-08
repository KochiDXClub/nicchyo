import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const insert = vi.fn();
const rpc = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "0123456789abcdef0123" }) }),
}));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: () => getUser() },
    from: () => ({ insert: (row: unknown) => insert(row) }),
  }),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({ rpc: (...args: unknown[]) => rpc(...args) }),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

function post(body: unknown) {
  return POST(
    new NextRequest("http://localhost/api/analytics/page-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

describe("POST /api/analytics/page-visit の来訪者数カウント", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    getUser.mockResolvedValue({ data: { user: null } });
  });

  it("どのページの訪問でも日次の来訪者数に数える", async () => {
    await post({ path: "/map", durationSeconds: 1 });
    expect(rpc).toHaveBeenCalledWith("track_home_visit", {
      p_visit_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      p_visitor_key: "0123456789abcdef0123",
    });
  });

  it("管理者の閲覧は数えない", async () => {
    getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } } });
    await post({ path: "/map", durationSeconds: 1 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("記録対象外のパスや書き込み失敗では数えない", async () => {
    await post({ path: "/api/x", durationSeconds: 1 });
    insert.mockResolvedValue({ error: { message: "x" } });
    await post({ path: "/map", durationSeconds: 1 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
