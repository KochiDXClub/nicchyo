import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { DEFAULT_SITE_COPY } from "@/lib/site-copy/content";

const auth = vi.hoisted(() => vi.fn());
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: auth }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: vi.fn().mockResolvedValue(null), getClientIp: vi.fn(() => "127.0.0.1") }));
const audit = vi.hoisted(() => vi.fn());
const revalidate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/audit/logAdminAudit", () => ({ logAdminAudit: audit }));
vi.mock("@/lib/site-copy/server", () => ({ revalidateSiteCopy: revalidate }));
import { PUT } from "./route";

function request(body: unknown, origin = "https://nicchyo.example") {
  return new Request("https://nicchyo.example/api/admin/site-copy", { method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }) as Parameters<typeof PUT>[0];
}
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ user: { id: "admin-id", email: "admin@example.test" }, role: "admin", adminClient: { rpc } }); rpc.mockResolvedValue({ data: 1, error: null }); });
describe("admin site copy", () => {
  it("管理者以外の更新を拒否する", async () => {
    auth.mockResolvedValue({ error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await PUT(request({ content: DEFAULT_SITE_COPY, revision: 0, publish: true }))).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("別オリジンからの更新を拒否する", async () => {
    expect((await PUT(request({ content: DEFAULT_SITE_COPY, revision: 0, publish: true }, "https://evil.example"))).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("不正な入力を保存しない", async () => {
    const content = { ...DEFAULT_SITE_COPY, texts: { ...DEFAULT_SITE_COPY.texts, "faq.title": "<script>alert(1)</script>" } };
    expect((await PUT(request({ content, revision: 0, publish: true }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("認証済み利用者と版番号を使って保存し、同時編集の衝突を返す", async () => {
    const body = { content: DEFAULT_SITE_COPY, revision: 4, publish: true };
    expect((await PUT(request(body))).status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("save_site_copy", expect.objectContaining({ p_expected_revision: 4, p_actor: "admin-id", p_publish: true }));
    rpc.mockResolvedValue({ data: null, error: { message: "site_copy_conflict" } });
    expect((await PUT(request(body))).status).toBe(409);
  });
  it("公開したときだけ文言キャッシュを捨て、監査ログに残す", async () => {
    expect((await PUT(request({ content: DEFAULT_SITE_COPY, revision: 0, publish: true }))).status).toBe(200);
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ id: "admin-id", role: "admin" }), expect.objectContaining({ action: "site_copy_publish" }));
  });
  it("下書き保存は来訪者の表示を変えないので、キャッシュは捨てず監査ログには下書きとして残す", async () => {
    expect((await PUT(request({ content: DEFAULT_SITE_COPY, revision: 0, publish: false }))).status).toBe(200);
    expect(revalidate).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ action: "site_copy_draft_save" }));
  });
});
