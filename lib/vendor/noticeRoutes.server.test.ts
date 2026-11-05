import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const eq = vi.fn();
const logAdminAudit = vi.fn();
const authorizeCity = vi.fn();
const authorizeAdmin = vi.fn();

vi.mock("@/lib/auth/requireCityApi", () => ({ requireCityApi: () => authorizeCity() }));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: () => authorizeAdmin() }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...a: unknown[]) => logAdminAudit(...a) }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));

import { createNotice, deleteNotice, listNotices } from "./noticeRoutes.server";

const row = {
  id: "11111111-1111-4111-8111-111111111111",
  sender: "city",
  title: "区画の変更",
  body: "本文",
  important: false,
  created_at: "2026-11-04T00:00:00Z",
};

function chain(result: unknown) {
  const q: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "delete"]) q[m] = () => q;
  q.eq = (...a: unknown[]) => {
    eq(...a);
    return q;
  };
  q.maybeSingle = async () => ({ data: row, error: null });
  q.then = (resolve: (v: unknown) => void) => resolve(result);
  return q;
}

function client() {
  return {
    from: () => ({
      ...chain({ data: [row], error: null }),
      insert: (v: unknown) => {
        insert(v);
        return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
      },
    }),
    rpc: async () => ({ data: [], error: null }),
  };
}

function ctx(role: string) {
  return { user: { id: "u1", email: "c@example.com" }, role, adminClient: client() };
}

const post = (body: unknown) =>
  new Request("https://nicchyo.example/api/city/vendor-notices", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  logAdminAudit.mockResolvedValue(undefined);
});

describe("高知市から出店者へのお知らせ", () => {
  it("高知市の担当者が「運営から」を名乗っても、差出人は高知市になる", async () => {
    authorizeCity.mockResolvedValue(ctx("city_official"));
    const res = await createNotice(post({ sender: "operator", title: "見出し", body: "本文", important: false }), "city");
    expect(res.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ sender: "city", created_by: "u1" }));
  });

  it("運営は差出人を選べる", async () => {
    authorizeAdmin.mockResolvedValue(ctx("admin"));
    await createNotice(post({ sender: "operator", title: "見出し", body: "本文", important: false }), "admin");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ sender: "operator" }));
  });

  it("一覧と取り下げは、高知市名義のものに絞る", async () => {
    authorizeCity.mockResolvedValue(ctx("city_official"));
    await listNotices(new Request("https://nicchyo.example/api/city/vendor-notices"), "city");
    expect(eq).toHaveBeenCalledWith("sender", "city");

    eq.mockClear();
    const res = await deleteNotice(
      new Request("https://nicchyo.example/x", { method: "DELETE" }),
      Promise.resolve({ id: row.id }),
      "city",
    );
    expect(res.status).toBe(200);
    expect(eq).toHaveBeenCalledWith("sender", "city");
  });

  it("権限がなければ何もせず、そのまま返す", async () => {
    authorizeCity.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    const res = await createNotice(post({}), "city");
    expect(res.status).toBe(401);
    expect(insert).not.toHaveBeenCalled();
  });
});
