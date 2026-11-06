import { beforeEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: auth }));
vi.mock("@/lib/admin/shopApiGuard", () => ({ guardAdminWrite: guard, UUID_RE: /^[0-9a-f-]{36}$/i }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: vi.fn() }));
vi.mock("@/app/(public)/map/services/shopCache", () => ({ revalidatePublicShops: vi.fn() }));
import { POST } from "./route";
const loc = "11111111-1111-4111-8111-111111111111", vendor = "22222222-2222-4222-8222-222222222222";
const request = () => new Request("https://example.test", { method: "POST" });
beforeEach(() => { vi.clearAllMocks(); guard.mockResolvedValue({ ctx: { adminClient: { rpc }, user: { id: "admin" }, role: "admin", ip: null }, body: { action: "addMembership", locationId: loc, vendorId: vendor, start: "2026-11-01", confirmed: false, seenCount: null } }); });
describe("出店予定API", () => {
  it("認可エラーならDBへ書き込まない", async () => { guard.mockResolvedValue({ error: new Response(null, { status: 401 }) }); expect((await POST(request())).status).toBe(401); expect(rpc).not.toHaveBeenCalled(); });
  it("他店舗がいる場合は確認を求め、DBの件数を返す", async () => { rpc.mockResolvedValue({ data: { status: "confirmation_required", count: 2 }, error: null }); const res = await POST(request()); expect(res.status).toBe(409); expect(await res.json()).toMatchObject({ needsConfirmation: true, count: 2 }); });
  it("古い画面からの上書きを拒否する", async () => { rpc.mockResolvedValue({ data: { status: "stale" }, error: null }); const res = await POST(request()); expect(res.status).toBe(409); expect((await res.json()).error).toContain("別の画面"); });
  it("実在しない日付を拒否する", async () => { const value = await guard(); value.body.start = "2026-02-30"; guard.mockResolvedValue(value); expect((await POST(request())).status).toBe(400); expect(rpc).not.toHaveBeenCalled(); });
  it("確認された登録を、確認時点の件数とともにDBへ渡す", async () => { const value = await guard(); value.body.confirmed = true; value.body.seenCount = 2; guard.mockResolvedValue(value); rpc.mockResolvedValue({ data: { status: "ok", vendorNumber: 3 }, error: null }); const res = await POST(request()); expect(res.status).toBe(200); expect(rpc).toHaveBeenCalledWith("add_market_place_membership", expect.objectContaining({ p_confirm: true, p_seen_count: 2 })); });
});
