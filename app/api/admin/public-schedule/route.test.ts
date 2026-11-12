import { beforeEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());
const readSchedule = vi.hoisted(() => vi.fn());
vi.mock("@/lib/market-schedule/read.server", () => ({ readScheduleData: readSchedule }));
vi.mock("@/lib/admin/shopApiGuard", () => ({ guardAdminWrite: guard }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: audit }));
vi.mock("@/app/(public)/map/services/shopCache", () => ({ revalidatePublicShops: vi.fn() }));
vi.mock("@/lib/market-schedule/rollout.server", () => ({ readPublicScheduleRollout: vi.fn(async () => false), revalidatePublicScheduleRollout: vi.fn() }));
import { POST } from "./route";
const request = () => new Request("https://example.test", { method: "POST" });
beforeEach(() => { vi.clearAllMocks(); readSchedule.mockResolvedValue({ places: [], vendors: [], memberships: [], periods: [], rules: [], overrides: [] }); guard.mockResolvedValue({ ctx: { adminClient: { rpc }, user: { id: "admin" }, role: "admin", ip: null }, body: { enabled: true, revision: 1, confirmed: true } }); });
describe("出店予定の公開設定", () => {
  it("認可を通らなければ変更しない", async () => { guard.mockResolvedValue({ error: new Response(null, { status: 401 }) }); expect((await POST(request())).status).toBe(401); expect(rpc).not.toHaveBeenCalled(); });
  it("確認なしには変更しない", async () => { const value = await guard(); value.body.confirmed = false; guard.mockResolvedValue(value); expect((await POST(request())).status).toBe(400); expect(rpc).not.toHaveBeenCalled(); });
  it("古い設定を上書きしない", async () => { rpc.mockResolvedValue({ data: { status: "stale" }, error: null }); expect((await POST(request())).status).toBe(409); expect(audit).not.toHaveBeenCalled(); });
  it("予定を確認できない場合は公開を開始しない", async () => {
    readSchedule.mockRejectedValue(new Error("failed"));
    expect((await POST(request())).status).toBe(500);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("管理者の確認を保存し監査する", async () => { rpc.mockResolvedValue({ data: { status: "ok" }, error: null }); expect((await POST(request())).status).toBe(200); expect(rpc).toHaveBeenCalledWith("set_public_schedule_rollout", { p_enabled: true, p_expected: 1, p_actor: "admin" }); expect(audit).toHaveBeenCalledOnce(); });
});
