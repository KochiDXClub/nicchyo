import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedShopMembership } from "@/lib/vendor/shopMembership";

const requireVendorContext = vi.fn();
const deleteMember = vi.fn();

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      if (table === "vendor_activity_logs") return { insert: async () => ({ error: null }) };
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        then: (resolve: (value: unknown) => unknown) => resolve(deleteMember(filters)),
      };
      return { delete: () => builder };
    },
  }),
}));

import { POST } from "./route";

const user = { id: "user-1", user_metadata: { name: "山田" } };
const ctx = (role: "owner" | "member"): unknown => ({
  ok: true,
  user,
  vendorId: "shop-1",
  membership: { vendorId: "shop-1", role, permissions: [], joinedAt: null } satisfies ResolvedShopMembership,
  supabase: {},
});
const leave = () => POST(new Request("http://localhost/api/vendor/members/leave", { method: "POST" }));

beforeEach(() => {
  vi.clearAllMocks();
  deleteMember.mockReturnValue({ error: null });
});

describe("POST /api/vendor/members/leave", () => {
  it("メンバーは自分の行だけを消して店舗を抜ける", async () => {
    requireVendorContext.mockResolvedValue(ctx("member"));

    expect((await leave()).status).toBe(200);
    expect(deleteMember).toHaveBeenCalledWith({ vendor_id: "shop-1", user_id: "user-1", role: "member" });
  });

  it("代表者は、引き継ぐまで抜けられない（409）", async () => {
    requireVendorContext.mockResolvedValue(ctx("owner"));

    expect((await leave()).status).toBe(409);
    expect(deleteMember).not.toHaveBeenCalled();
  });
});
