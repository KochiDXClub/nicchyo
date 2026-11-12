import { beforeEach, describe, expect, it, vi } from "vitest";
const guard = vi.hoisted(() => vi.fn());
vi.mock("@/lib/admin/shopApiGuard", () => ({ guardAdminShopWrite: guard, UUID_RE: /^[0-9a-f-]{36}$/i }));
import { PUT } from "./route";
const id = "11111111-1111-4111-8111-111111111111";
const req = () => new Request("https://example.test", { method: "PUT" });
beforeEach(() => { vi.clearAllMocks(); guard.mockResolvedValue({ ctx: { id }, body: {} }); });
describe("旧単一出店場所API", () => {
  it("認可エラーをそのまま返す", async () => { guard.mockResolvedValue({ error: new Response(null, { status: 401 }) }); expect((await PUT(req(), { params: Promise.resolve({ id }) })).status).toBe(401); });
  it("旧画面による単一場所の上書きを拒否する", async () => { const res = await PUT(req(), { params: Promise.resolve({ id }) }); expect(res.status).toBe(409); expect((await res.json()).error).toContain("出店予定管理"); });
});
