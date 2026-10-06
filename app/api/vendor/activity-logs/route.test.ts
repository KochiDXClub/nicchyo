import { beforeEach, describe, expect, it, vi } from "vitest";

const requireVendorContext = vi.fn();
const eq = vi.fn();
let rows: unknown[] = [];

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: (...args: unknown[]) => requireVendorContext(...args),
}));
vi.mock("@/lib/supabase/adminClient", () => ({
  createAdminClient: () => {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = (...args: unknown[]) => (eq(...args), chain);
    chain.order = () => chain;
    chain.limit = () => chain;
    chain.lt = () => chain;
    chain.then = (resolve: (value: unknown) => void) => resolve({ data: rows, error: null });
    return { from: () => chain };
  },
}));

import { GET } from "./route";

const get = (qs = "") => GET(new Request(`http://localhost/api/vendor/activity-logs${qs}`));
const row = (id: number) => ({ id, actor_name: "山田", action: "invite.create", summary: `記録${id}`, created_at: "2026-10-03T05:00:00Z" });

beforeEach(() => {
  vi.clearAllMocks();
  rows = [row(1)];
  requireVendorContext.mockResolvedValue({ ok: true, user: { id: "u" }, vendorId: "shop-1", membership: { role: "owner", permissions: [], vendorId: "shop-1", joinedAt: null }, supabase: {} });
});

describe("GET /api/vendor/activity-logs", () => {
  it("操作ログの閲覧の権限で呼び、自分の店舗の分だけを読む", async () => {
    const body = await (await get()).json();

    expect(requireVendorContext).toHaveBeenCalledWith({ permission: "audit_view" });
    expect(eq).toHaveBeenCalledWith("vendor_id", "shop-1");
    expect(body.logs[0]).toMatchObject({ summary: "記録1", actorName: "山田", label: "招待リンクを作った" });
  });

  it("権限がなければ読めない", async () => {
    requireVendorContext.mockResolvedValue({ ok: false, response: new Response(null, { status: 403 }) });

    expect((await get()).status).toBe(403);
  });

  it("31件読めたら、30件を返して、続きがあると伝える", async () => {
    rows = Array.from({ length: 31 }, (_, i) => row(i + 1));

    const body = await (await get()).json();

    expect(body.logs).toHaveLength(30);
    expect(body.hasMore).toBe(true);
  });

  it("日時の形が正しくなければ 400", async () => {
    expect((await get("?before=yesterday")).status).toBe(400);
  });
});
