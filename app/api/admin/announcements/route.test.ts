import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.fn();
const logAdminAudit = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/admin/shopApiGuard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/shopApiGuard")>()),
  guardAdminWrite: (...args: unknown[]) => guard(...args),
}));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: vi.fn() }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...args: unknown[]) => logAdminAudit(...args) }));

import { POST } from "./route";

const saved = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "雨天中止",
  body: "中止です",
  important: true,
  published: true,
  starts_at: "2026-10-12T03:00:00.000Z",
  ends_at: null,
  created_at: "2026-10-12T03:00:00.000Z",
  updated_at: "2026-10-12T03:00:00.000Z",
};

function post(body: unknown) {
  return POST(new Request("https://nicchyo.example/api/admin/announcements", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  logAdminAudit.mockResolvedValue(undefined);
  insert.mockImplementation(() => ({ select: () => ({ single: async () => ({ data: saved, error: null }) }) }));
  const adminClient = { from: () => ({ insert: (...args: unknown[]) => insert(...args) }) };
  guard.mockImplementation(async (request: Request) => ({
    ctx: { user: { id: "admin-1", email: "a@example.com" }, role: "admin", adminClient, ip: null },
    body: await request.json(),
  }));
});

describe("POST /api/admin/announcements", () => {
  it("投稿すると保存し、操作ログを残して 201", async () => {
    const res = await post({ title: " 雨天中止 ", body: "中止です", important: true });
    expect(res.status).toBe(201);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ title: "雨天中止", body: "中止です", important: true, published: true, ends_at: null, created_by: "admin-1" })
    );
    expect(logAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "admin-1" }),
      expect.objectContaining({ action: "announcement_create", targetId: saved.id })
    );
    expect(((await res.json()) as { announcement: { id: string; startsAt: string } }).announcement).toMatchObject({ id: saved.id, startsAt: saved.starts_at });
  });

  it("入力が不正なら 400 で、保存しない", async () => {
    for (const body of [{}, { title: "a" }, { title: "a", body: "b", startsAt: "2026-10-20T00:00:00Z", endsAt: "2026-10-19T00:00:00Z" }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("保存できなかったら 500", async () => {
    insert.mockImplementationOnce(() => ({ select: () => ({ single: async () => ({ data: null, error: { code: "x" } }) }) }));
    expect((await post({ title: "a", body: "b" })).status).toBe(500);
    expect(logAdminAudit).not.toHaveBeenCalled();
  });
});
