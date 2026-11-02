import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminApi = vi.fn();
const logAdminAudit = vi.fn();
const insertInvite = vi.fn();
const insertActivity = vi.fn();
let owners: { user_id: string }[] = [];
let vendor: { shop_name: string; role?: string } | null = { shop_name: "山田農園" };

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: () => requireAdminApi() }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: (...args: unknown[]) => logAdminAudit(...args) }));

import { POST } from "./route";

const A = "00000000-0000-4000-8000-00000000000a";
const INVITE = "00000000-0000-4000-8000-0000000000aa";

function post(body: unknown) {
  return POST(
    new Request("https://nicchyo.example/api/admin/shop-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  owners = [{ user_id: "u1" }];
  vendor = { shop_name: "山田農園" };
  const adminClient = {
    from: (table: string) => {
      if (table === "vendor_activity_logs") return { insert: (rows: unknown) => insertActivity(rows) };
      if (table === "vendors") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: vendor }) }) }) };
      if (table === "shop_members") return { select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: owners, error: null }) }) }) }) };
      return {
        insert: (row: unknown) => ({ select: () => ({ single: async () => insertInvite(row) }) }),
        update: () => ({ eq: () => ({ eq: () => ({ is: () => ({ select: async () => ({ data: [{ id: INVITE }], error: null }) }) }) }) }),
      };
    },
  };
  requireAdminApi.mockResolvedValue({ user: { id: "admin-1", email: "a@example.com" }, role: "admin", adminClient });
  insertInvite.mockResolvedValue({ data: { id: INVITE }, error: null });
  insertActivity.mockResolvedValue({ error: null });
  logAdminAudit.mockResolvedValue(undefined);
});

describe("POST /api/admin/shop-invites", () => {
  it("管理者でなければ何もしない", async () => {
    requireAdminApi.mockResolvedValue({ error: new Response(null, { status: 401 }) });
    expect((await post({ action: "create", vendorId: A, maxUses: 1, permissions: [] })).status).toBe(401);
    expect(insertInvite).not.toHaveBeenCalled();
  });

  it("人数が範囲外なら作らない", async () => {
    expect((await post({ action: "create", vendorId: A, maxUses: 9, permissions: [] })).status).toBe(400);
    expect(insertInvite).not.toHaveBeenCalled();
  });

  it("代表者がいない店舗には作らない", async () => {
    owners = [];
    expect((await post({ action: "create", vendorId: A, maxUses: 1, permissions: [] })).status).toBe(409);
    expect(insertInvite).not.toHaveBeenCalled();
  });

  it("リンクを作り、URL を返す。DB にはハッシュだけを渡し、店舗の操作ログと監査ログを残す", async () => {
    const res = await post({ action: "create", vendorId: A, maxUses: 2, permissions: ["post"] });
    expect(res.status).toBe(201);
    const { url } = (await res.json()) as { url: string };
    const token = url.split("/join/")[1];
    const row = insertInvite.mock.calls[0][0] as Record<string, unknown>;
    expect(row.vendor_id).toBe(A);
    expect(row.max_uses).toBe(2);
    expect(row.permissions).toEqual(["post"]);
    expect(JSON.stringify(row)).not.toContain(token);
    expect(logAdminAudit).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ action: "shop_invite_create", targetId: A }));
    expect(insertActivity).toHaveBeenCalled();
  });

  it("リンクを取り消すと、監査ログを残す", async () => {
    const res = await post({ action: "revoke", vendorId: A, inviteId: INVITE });
    expect(res.status).toBe(200);
    expect(logAdminAudit).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ action: "shop_invite_revoke" }));
  });

  it("運営アカウントの行は店舗として扱わない（404）", async () => {
    vendor = { shop_name: "運営", role: "admin" };
    expect((await post({ action: "create", vendorId: A, maxUses: 1, permissions: [] })).status).toBe(404);
    expect(insertInvite).not.toHaveBeenCalled();
  });

  it("店舗がなければ 404", async () => {
    vendor = null;
    expect((await post({ action: "revoke", vendorId: A, inviteId: INVITE })).status).toBe(404);
  });
});
