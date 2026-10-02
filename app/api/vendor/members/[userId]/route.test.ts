import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedShopMembership } from "@/lib/vendor/shopMembership";

const requireVendorContext = vi.fn();
const memberRow = vi.fn();
const updateMember = vi.fn();
const deleteMember = vi.fn();
const insertLog = vi.fn();

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));

/** 絞り込み（eq）の組を覚えておき、店舗をまたいでいないことも確かめる */
function chain(finish: (filters: Record<string, unknown>) => unknown) {
  const filters: Record<string, unknown> = {};
  const builder: Record<string, unknown> = {
    eq: (column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    },
    then: (resolve: (value: unknown) => unknown) => resolve(finish(filters)),
  };
  return builder;
}

vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "t@example.com", user_metadata: { name: "対象" } } } }) } },
    from: (table: string) => {
      if (table === "vendor_activity_logs") return { insert: (row: unknown) => insertLog(row) };
      return {
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: () => memberRow() }) }) }),
        update: (values: unknown) => chain((filters) => updateMember(values, filters)),
        delete: () => chain((filters) => deleteMember(filters)),
      };
    },
  }),
}));

import { DELETE, PATCH } from "./route";

const TARGET = "00000000-0000-4000-8000-000000000002";
const user = { id: "00000000-0000-4000-8000-000000000001", user_metadata: { name: "操作者" } };
const owner: ResolvedShopMembership = { vendorId: "shop-1", role: "owner", permissions: [], joinedAt: null };
const deputy: ResolvedShopMembership = {
  vendorId: "shop-1",
  role: "member",
  permissions: ["store_edit", "post", "members_manage"],
  joinedAt: null,
};

const ctx = (membership: ResolvedShopMembership) => ({ ok: true, user, vendorId: "shop-1", membership, supabase: {} });
const row = (role: string, permissions: string[], userId = TARGET) => ({
  data: { user_id: userId, role, permissions, created_at: "2026-10-01T00:00:00Z" },
});
const params = (userId = TARGET) => ({ params: Promise.resolve({ userId }) });
const patch = (permissions: unknown, userId = TARGET) =>
  PATCH(
    new Request("http://localhost/api/vendor/members/x", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ permissions }),
    }),
    params(userId),
  );
const remove = (userId = TARGET) =>
  DELETE(new Request("http://localhost/api/vendor/members/x", { method: "DELETE" }), params(userId));

beforeEach(() => {
  vi.clearAllMocks();
  requireVendorContext.mockResolvedValue(ctx(owner));
  memberRow.mockResolvedValue(row("member", ["post"]));
  updateMember.mockReturnValue({ error: null });
  deleteMember.mockReturnValue({ error: null });
  insertLog.mockResolvedValue({ error: null });
});

describe("PATCH /api/vendor/members/[userId]", () => {
  it("メンバー管理の権限で呼ぶ", async () => {
    await patch(["post"]);

    expect(requireVendorContext).toHaveBeenCalledWith({ permission: "members_manage" });
  });

  it("代表者は権限を差し替えられる。店舗とメンバーで絞った更新になり、操作ログも残る", async () => {
    const res = await patch(["store_edit", "post"]);

    expect(res.status).toBe(200);
    expect(updateMember).toHaveBeenCalledWith(
      expect.objectContaining({ permissions: ["store_edit", "post"] }),
      { vendor_id: "shop-1", user_id: TARGET, role: "member" },
    );
    expect(insertLog.mock.calls[0][0]).toMatchObject({ vendor_id: "shop-1", action: "member.permissions", target_id: TARGET });
  });

  it("uuid でない ID・見つからない人は 404、権限の形が違えば 400", async () => {
    expect((await patch(["post"], "not-a-uuid")).status).toBe(404);
    memberRow.mockResolvedValue({ data: null });
    expect((await patch(["post"])).status).toBe(404);
    memberRow.mockResolvedValue(row("member", []));
    expect((await patch("post")).status).toBe(400);
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("代表者の権限は変えられない", async () => {
    memberRow.mockResolvedValue(row("owner", []));

    expect((await patch(["post"])).status).toBe(403);
    expect(updateMember).not.toHaveBeenCalled();
  });

  it("自分自身の権限は変えられない", async () => {
    memberRow.mockResolvedValue(row("member", ["post"], user.id));

    expect((await patch(["post", "store_edit"], user.id)).status).toBe(403);
  });

  it("副代表は、members_manage を付けられない・副代表を動かせない・自分が持たない権限を付けられない", async () => {
    requireVendorContext.mockResolvedValue(ctx(deputy));

    expect((await patch(["post", "members_manage"])).status).toBe(403);
    expect((await patch(["analytics"])).status).toBe(403);
    memberRow.mockResolvedValue(row("member", ["members_manage"]));
    expect((await patch(["post"])).status).toBe(403);
    expect(updateMember).not.toHaveBeenCalled();

    memberRow.mockResolvedValue(row("member", ["post"]));
    expect((await patch(["store_edit"])).status).toBe(200);
  });
});

describe("DELETE /api/vendor/members/[userId]", () => {
  it("代表者はメンバーを外せる（店舗で絞る）。ログも残る", async () => {
    expect((await remove()).status).toBe(200);

    expect(deleteMember).toHaveBeenCalledWith({ vendor_id: "shop-1", user_id: TARGET, role: "member" });
    expect(insertLog.mock.calls[0][0]).toMatchObject({ action: "member.remove" });
  });

  it("代表者・自分自身・（副代表から見た）副代表は外せない", async () => {
    memberRow.mockResolvedValue(row("owner", []));
    expect((await remove()).status).toBe(403);

    memberRow.mockResolvedValue(row("member", [], user.id));
    expect((await remove(user.id)).status).toBe(403);

    requireVendorContext.mockResolvedValue(ctx(deputy));
    memberRow.mockResolvedValue(row("member", ["members_manage"]));
    expect((await remove()).status).toBe(403);
    expect(deleteMember).not.toHaveBeenCalled();
  });
});
