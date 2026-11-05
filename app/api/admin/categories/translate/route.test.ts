import { beforeEach, describe, expect, it, vi } from "vitest";

const guard = vi.fn();
const requestChatCompletion = vi.fn();

vi.mock("@/lib/admin/shopApiGuard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/shopApiGuard")>()),
  guardAdminWrite: (...args: unknown[]) => guard(...args),
}));
vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: vi.fn() }));
vi.mock("@/lib/ai/modelStore.server", () => ({ resolveAiModelFor: async () => ({ def: { id: "test-model" } }) }));
vi.mock("@/lib/ai/openaiFetch", () => ({ requestChatCompletion: (...args: unknown[]) => requestChatCompletion(...args) }));

import { POST } from "./route";

const aiReply = (content: string) => ({ ok: true, json: async () => ({ choices: [{ message: { content } }] }) });
const post = (body: unknown) => POST(new Request("https://nicchyo.example/api/admin/categories/translate", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  guard.mockImplementation(async (request: Request) => ({ ctx: { user: { id: "admin-1" } }, body: await request.json() }));
});

describe("POST /api/admin/categories/translate", () => {
  it("日本語名を英語名にして返す（保存はしない）", async () => {
    requestChatCompletion.mockResolvedValue(aiReply(JSON.stringify({ name: "Food" })));
    const res = await post({ name: "食べ物" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, nameEn: "Food" });
  });

  it("管理者でなければ AI を呼ばない", async () => {
    guard.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    expect((await post({ name: "食べ物" })).status).toBe(403);
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("名前が空・長すぎるなら 400、キー未設定は 503、読めない返事は 502", async () => {
    for (const body of [{}, { name: " " }, { name: "あ".repeat(51) }]) expect((await post(body)).status).toBe(400);
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await post({ name: "食べ物" })).status).toBe(503);
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    requestChatCompletion.mockResolvedValueOnce(aiReply(JSON.stringify({ x: 1 })));
    expect((await post({ name: "食べ物" })).status).toBe(502);
    expect(requestChatCompletion).toHaveBeenCalledTimes(1);
  });
});
