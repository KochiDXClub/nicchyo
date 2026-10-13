import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.fn();
const logAdminAudit = vi.fn();
const updateCalls: { values: Record<string, unknown>; id?: unknown }[] = [];
let updated: unknown;
let deleted: unknown;

vi.mock("@/lib/admin/shopApiGuard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/shopApiGuard")>()),
  guardAdminShopWrite: (...args: unknown[]) => guard(...args),
}));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: vi.fn() }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...args: unknown[]) => logAdminAudit(...args) }));

import { DELETE, PATCH } from "./route";

const ID = "11111111-1111-4111-8111-111111111111";
const row = {
  id: ID,
  title: "雨天中止",
  body: "中止です",
  important: false,
  published: false,
  starts_at: "2026-10-12T03:00:00.000Z",
  ends_at: null,
  created_at: "2026-10-12T03:00:00.000Z",
  updated_at: "2026-10-12T04:00:00.000Z",
};

const params = Promise.resolve({ id: ID });
const patch = (body: unknown) => PATCH(new Request("https://nicchyo.example/x", { method: "PATCH", body: JSON.stringify(body) }), { params });
const del = () => DELETE(new Request("https://nicchyo.example/x", { method: "DELETE" }), { params });

beforeEach(() => {
  vi.clearAllMocks();
  updateCalls.length = 0;
  updated = row;
  deleted = { id: ID, title: "雨天中止" };
  logAdminAudit.mockResolvedValue(undefined);
  const adminClient = {
    from: () => ({
      update: (values: Record<string, unknown>) => {
        const call: { values: Record<string, unknown>; id?: unknown } = { values };
        updateCalls.push(call);
        return { eq: (_c: string, id: unknown) => ((call.id = id), { select: () => ({ maybeSingle: async () => ({ data: updated, error: null }) }) }) };
      },
      delete: () => ({ eq: () => ({ select: () => ({ maybeSingle: async () => ({ data: deleted, error: null }) }) }) }),
    }),
  };
  guard.mockImplementation(async (request: Request) => ({
    ctx: { user: { id: "admin-1", email: "a@example.com" }, role: "admin", adminClient, ip: null, id: ID },
    body: request.method === "DELETE" ? null : await request.json(),
  }));
});

describe("PATCH /api/admin/announcements/[id]", () => {
  it("全項目を更新する（非公開への切り替えも同じ）。操作ログを残す", async () => {
    const res = await patch({ title: "雨天中止", body: "中止です", published: false });
    expect(res.status).toBe(200);
    expect(updateCalls[0].id).toBe(ID);
    expect(updateCalls[0].values).toMatchObject({ title: "雨天中止", published: false, ends_at: null });
    expect(logAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "announcement_update", targetId: ID })
    );
  });

  it("入力が不正なら 400、存在しなければ 404", async () => {
    expect((await patch({ title: "", body: "b" })).status).toBe(400);
    expect(updateCalls).toHaveLength(0);
    updated = null;
    expect((await patch({ title: "a", body: "b" })).status).toBe(404);
  });
});

describe("DELETE /api/admin/announcements/[id]", () => {
  it("削除して、操作ログを残す", async () => {
    expect((await del()).status).toBe(200);
    expect(logAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ action: "announcement_delete", targetName: "雨天中止" })
    );
  });

  it("存在しなければ 404", async () => {
    deleted = null;
    expect((await del()).status).toBe(404);
    expect(logAdminAudit).not.toHaveBeenCalled();
  });
});
