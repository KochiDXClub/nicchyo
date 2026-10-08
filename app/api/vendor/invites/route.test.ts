import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedShopMembership } from "@/lib/vendor/shopMembership";

const requireVendorContext = vi.fn();
const insertInvite = vi.fn();
const insertLog = vi.fn();

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "shop_invites"
        ? { insert: (row: unknown) => ({ select: () => ({ single: () => insertInvite(row) }) }) }
        : { insert: (row: unknown) => insertLog(row) },
  }),
}));

import { POST } from "./route";

const user = { id: "user-1", email: "a@example.com", user_metadata: { name: "山田" } };
const owner: ResolvedShopMembership = { vendorId: "shop-1", role: "owner", permissions: [], joinedAt: null };
const deputy: ResolvedShopMembership = {
  vendorId: "shop-1",
  role: "member",
  permissions: ["store_edit", "post", "members_manage"],
  joinedAt: null,
};

function ctx(membership: ResolvedShopMembership) {
  return { ok: true, user, vendorId: membership.vendorId, membership, supabase: {} };
}

function create(body: unknown) {
  return POST(
    new Request("https://nicchyo.example/api/vendor/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  requireVendorContext.mockResolvedValue(ctx(owner));
  insertInvite.mockResolvedValue({ data: { id: "invite-1" }, error: null });
  insertLog.mockResolvedValue({ error: null });
});

describe("POST /api/vendor/invites", () => {
  it("メンバー管理の権限で呼ぶ", async () => {
    await create({ maxUses: 2, permissions: ["post"] });

    expect(requireVendorContext).toHaveBeenCalledWith({ permission: "members_manage" });
  });

  it("リンクを作り、URL は 1 回だけ返す。DB にはトークンそのものではなくハッシュと、7 日以内の期限を入れる", async () => {
    const res = await create({ maxUses: 3, permissions: ["store_edit", "post"] });
    const body = await res.json();

    expect(res.status).toBe(201);
    const token = body.url.split("/join/")[1];
    expect(body.url.startsWith("https://nicchyo.example/join/")).toBe(true);
    expect(token).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const row = insertInvite.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({ vendor_id: "shop-1", max_uses: 3, permissions: ["store_edit", "post"], created_by: "user-1" });
    expect(JSON.stringify(row)).not.toContain(token);
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    const days = (Date.parse(row.expires_at as string) - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThanOrEqual(7);
  });

  it("操作ログを残す（リンクの本体は入れない）", async () => {
    const res = await create({ maxUses: 1, permissions: [] });
    const { url } = await res.json();

    const log = insertLog.mock.calls[0][0] as Record<string, unknown>;
    expect(log).toMatchObject({ vendor_id: "shop-1", actor_id: "user-1", actor_name: "山田", action: "invite.create" });
    expect(JSON.stringify(log)).not.toContain(url.split("/join/")[1]);
  });

  it("人数は 1〜5 人。範囲外・小数・文字は 400 で、何も作らない", async () => {
    for (const maxUses of [0, 6, 2.5, "3"]) {
      expect((await create({ maxUses, permissions: [] })).status).toBe(400);
    }
    expect((await create({ permissions: [] })).status).toBe(400);
    expect(insertInvite).not.toHaveBeenCalled();
  });

  it("知らない権限キーは無視する", async () => {
    await create({ maxUses: 1, permissions: ["post", "root"] });

    expect((insertInvite.mock.calls[0][0] as { permissions: string[] }).permissions).toEqual(["post"]);
  });

  it("副代表は members_manage を付けられず、自分が持たない権限も付けられない", async () => {
    requireVendorContext.mockResolvedValue(ctx(deputy));

    expect((await create({ maxUses: 1, permissions: ["members_manage"] })).status).toBe(403);
    expect((await create({ maxUses: 1, permissions: ["analytics"] })).status).toBe(403);
    expect(insertInvite).not.toHaveBeenCalled();
    expect((await create({ maxUses: 1, permissions: ["post"] })).status).toBe(201);
  });

  it("権限がなければ（requireVendorContext が弾けば）何も作らない", async () => {
    requireVendorContext.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });

    expect((await create({ maxUses: 1, permissions: [] })).status).toBe(403);
    expect(insertInvite).not.toHaveBeenCalled();
  });
});
