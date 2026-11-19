import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn());
const guard = vi.hoisted(() => vi.fn());
const insert = vi.hoisted(() => vi.fn());
const candidateQuery = vi.hoisted(() => vi.fn());
const audit = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: auth }));
vi.mock("@/lib/admin/shopApiGuard", () => ({ guardAdminWrite: guard, UUID_RE: /^[0-9a-f-]{36}$/i }));
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: audit }));
import { GET, POST } from "./route";
const vendorId = "22222222-2222-4222-8222-222222222222";
const request = () => new Request("https://example.test", { method: "POST" });
beforeEach(() => { vi.clearAllMocks(); candidateQuery.mockResolvedValue({ data: null, error: null }); guard.mockResolvedValue({ ctx: { adminClient: { from: (table: string) => table === "legacy_shop_identity_candidates" ? { select: () => ({ eq: () => ({ maybeSingle: candidateQuery }) }) } : { insert } }, user: { id: "admin" }, role: "admin", ip: null }, body: { legacyId: 12, vendorId, evidence: "紙台帳と店舗情報を確認しました", confirmed: true } }); });
describe("旧店舗番号の管理", () => {
  it("管理者以外は閲覧できない", async () => { auth.mockResolvedValue({ error: new Response(null, { status: 401 }) }); expect((await GET()).status).toBe(401); });
  it("明示的な確認と根拠なしには確定しない", async () => { const value = await guard(); value.body.confirmed = false; guard.mockResolvedValue(value); expect((await POST(request())).status).toBe(400); expect(insert).not.toHaveBeenCalled(); });
  it("確定済みの番号を上書きしない", async () => { insert.mockResolvedValue({ error: { code: "23505" } }); expect((await POST(request())).status).toBe(409); expect(audit).not.toHaveBeenCalled(); });
  it("誤った対応を理由付きで取り消し、別店舗には付け替えない", async () => {
    const value = await guard(); value.body.action = "revoke"; guard.mockResolvedValue(value); insert.mockResolvedValue({ error: null });
    expect((await POST(request())).status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ legacy_shop_id: 12, revoked_by: "admin", reason: "紙台帳と店舗情報を確認しました" }));
    expect(audit).toHaveBeenCalledOnce();
  });
  it("複数店舗の履歴がある旧番号は確定しない", async () => {
    candidateQuery.mockResolvedValue({ data: { candidate_count: 2, vendor_ids: [vendorId, "another"] }, error: null });
    expect((await POST(request())).status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });
  it("履歴にない別店舗を対応させない", async () => {
    candidateQuery.mockResolvedValue({ data: { candidate_count: 1, vendor_ids: ["another"] }, error: null });
    expect((await POST(request())).status).toBe(409);
    expect(insert).not.toHaveBeenCalled();
  });
  it("根拠と実行者を保存して監査する", async () => { insert.mockResolvedValue({ error: null }); expect((await POST(request())).status).toBe(200); expect(insert).toHaveBeenCalledWith(expect.objectContaining({ legacy_shop_id: 12, vendor_id: vendorId, confirmed_by: "admin" })); expect(audit).toHaveBeenCalledOnce(); });
});
