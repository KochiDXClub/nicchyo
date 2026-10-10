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

const CATEGORY = "00000000-0000-4000-8000-0000000000c1";

function post(body: unknown) {
  return POST(new Request("https://nicchyo.example/api/admin/shops", { method: "POST", body: JSON.stringify(body) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  logAdminAudit.mockResolvedValue(undefined);
  insert.mockImplementation((values: { id: string }) => ({
    select: () => ({ single: async () => ({ data: { id: values.id }, error: null }) }),
  }));
  const adminClient = { from: () => ({ insert: (...args: unknown[]) => insert(...args) }) };
  guard.mockImplementation(async (request: Request) => ({
    ctx: { user: { id: "admin-1", email: "a@example.com" }, role: "admin", adminClient, ip: null },
    body: await request.json(),
  }));
});

describe("POST /api/admin/shops（現場での新規登録）", () => {
  it("店名だけで作る。掲載許可は未取得（来訪者には出ない）で、操作ログを残す", async () => {
    const res = await post({ shop_name: "  新しい八百屋 " });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(insert).toHaveBeenCalledWith({ id, shop_name: "新しい八百屋", category_id: null, listing_status: "pending" });
    expect(logAdminAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: "admin-1" }),
      expect.objectContaining({ action: "shop_create", targetId: id, targetName: "新しい八百屋" }),
    );
  });

  it("カテゴリを付けて作れる", async () => {
    await post({ shop_name: "花屋", category_id: CATEGORY });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ category_id: CATEGORY, listing_status: "pending" }));
  });

  it("店名が空・長すぎる・カテゴリが不正なら 400 で、何も作らない", async () => {
    for (const body of [{}, { shop_name: "" }, { shop_name: "   " }, { shop_name: "あ".repeat(101) }, { shop_name: "花屋", category_id: "x" }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(insert).not.toHaveBeenCalled();
  });

  it("作れなかったら 500（店は残らない）", async () => {
    insert.mockImplementationOnce(() => ({ select: () => ({ single: async () => ({ data: null, error: { code: "x" } }) }) }));
    expect((await post({ shop_name: "花屋" })).status).toBe(500);
    expect(logAdminAudit).not.toHaveBeenCalled();
  });
});
