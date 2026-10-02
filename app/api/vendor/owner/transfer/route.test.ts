import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedShopMembership } from "@/lib/vendor/shopMembership";

const requireVendorContext = vi.fn();
const memberRow = vi.fn();
const rpc = vi.fn();
const insertLog = vi.fn();

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    rpc: (...args: unknown[]) => rpc(...args),
    auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { name: "次の代表" } } } }) } },
    from: (table: string) =>
      table === "vendor_activity_logs"
        ? { insert: (row: unknown) => insertLog(row) }
        : { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => memberRow() }) }) }) },
  }),
}));

import { POST } from "./route";

const NEXT = "00000000-0000-4000-8000-000000000002";
const user = { id: "00000000-0000-4000-8000-000000000001", user_metadata: { name: "いまの代表" } };
const owner: ResolvedShopMembership = { vendorId: "shop-1", role: "owner", permissions: [], joinedAt: null };
const deputy: ResolvedShopMembership = { vendorId: "shop-1", role: "member", permissions: ["members_manage"], joinedAt: null };

const ctx = (membership: ResolvedShopMembership) => ({ ok: true, user, vendorId: "shop-1", membership, supabase: {} });
const transfer = (body: unknown) =>
  POST(
    new Request("http://localhost/api/vendor/owner/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  requireVendorContext.mockResolvedValue(ctx(owner));
  memberRow.mockResolvedValue({ data: { user_id: NEXT, role: "member", permissions: ["post"], created_at: "x" } });
  rpc.mockResolvedValue({ data: "ok", error: null });
  insertLog.mockResolvedValue({ error: null });
});

describe("POST /api/vendor/owner/transfer", () => {
  it("代表者は同じ店舗のメンバーに引き継げる。DB の関数に店舗・今の代表者・次の代表者を渡し、ログを残す", async () => {
    const res = await transfer({ toUserId: NEXT });

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("transfer_shop_ownership", {
      p_vendor_id: "shop-1",
      p_from_user: user.id,
      p_to_user: NEXT,
    });
    expect(insertLog.mock.calls[0][0]).toMatchObject({ action: "owner.transfer", target_id: NEXT });
  });

  it("代表者でなければ、メンバー管理の権限があっても引き継げない", async () => {
    requireVendorContext.mockResolvedValue(ctx(deputy));

    expect((await transfer({ toUserId: NEXT })).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("自分・店舗にいない人・代表者自身・uuid でない値には引き継げない", async () => {
    expect((await transfer({ toUserId: "nope" })).status).toBe(400);
    memberRow.mockResolvedValue({ data: null });
    expect((await transfer({ toUserId: NEXT })).status).toBe(400);
    memberRow.mockResolvedValue({ data: { user_id: user.id, role: "owner", permissions: [], created_at: "x" } });
    expect((await transfer({ toUserId: user.id })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("DB が引き継ぎを断ったら 409（ログは残さない）", async () => {
    rpc.mockResolvedValue({ data: "not_owner", error: null });

    expect((await transfer({ toUserId: NEXT })).status).toBe(409);
    expect(insertLog).not.toHaveBeenCalled();
  });
});
