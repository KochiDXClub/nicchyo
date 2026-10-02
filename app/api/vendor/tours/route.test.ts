import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const upsert = vi.fn();
const selectRows = vi.fn();
let sameOrigin = true;

vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("@/lib/security/requestGuards", () => ({
  requireSameOrigin: () =>
    sameOrigin ? { ok: true } : { ok: false, response: new Response(null, { status: 403 }) },
}));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => ({
    auth: { getUser: () => getUser() },
    from: () => ({
      select: () => ({ eq: () => selectRows() }),
      upsert: (...args: unknown[]) => upsert(...args),
    }),
  }),
}));

import { GET, POST } from "./route";

const VENDOR = { id: "vendor-1", app_metadata: { role: "vendor" } };

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/vendor/tours", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sameOrigin = true;
  getUser.mockResolvedValue({ data: { user: VENDOR } });
  upsert.mockResolvedValue({ error: null });
  selectRows.mockResolvedValue({ data: [{ tour_key: "home" }, { tour_key: "store" }], error: null });
});

describe("GET /api/vendor/tours", () => {
  it("自分が見た説明の名前を返す", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ seen: ["home", "store"] });
  });

  it("ログインしていなければ 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    expect((await GET()).status).toBe(401);
  });

  it("出店者でなければ拒む", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "v", app_metadata: { role: "visitor" } } } });

    expect((await GET()).status).toBeGreaterThanOrEqual(400);
  });
});

describe("POST /api/vendor/tours", () => {
  it("見た機能を、自分の行としてまとめて記録する（すでにあれば何もしない）", async () => {
    const res = await post({ keys: ["home-chat", "home-calendar", "home-chat"] });

    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(
      [
        { vendor_id: "vendor-1", tour_key: "home-chat" },
        { vendor_id: "vendor-1", tour_key: "home-calendar" },
      ],
      { onConflict: "vendor_id,tour_key", ignoreDuplicates: true }
    );
  });

  it("知らない名前や、形の違う本文、多すぎる数は 400 で、記録しない", async () => {
    expect((await post({ keys: ["unknown"] })).status).toBe(400);
    expect((await post({ keys: ["home-chat", "unknown"] })).status).toBe(400);
    expect((await post({ keys: [] })).status).toBe(400);
    expect((await post({ key: "home-chat" })).status).toBe(400);
    expect((await post({})).status).toBe(400);
    expect((await post({ keys: Array(11).fill("home-chat") })).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("別のオリジンからは 403 で、記録しない", async () => {
    sameOrigin = false;

    expect((await post({ keys: ["home-chat"] })).status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("保存に失敗したら 500", async () => {
    upsert.mockResolvedValue({ error: { message: "x" } });

    expect((await post({ keys: ["home-chat"] })).status).toBe(500);
  });
});
