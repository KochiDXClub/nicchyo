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
const post = (body: unknown) => POST(new Request("https://nicchyo.example/api/admin/announcements/translate", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  guard.mockImplementation(async (request: Request) => ({ ctx: { user: { id: "admin-1" } }, body: await request.json() }));
});

describe("POST /api/admin/announcements/translate", () => {
  it("日本語のタイトル・本文を英訳して返す（保存はしない）", async () => {
    requestChatCompletion.mockResolvedValue(aiReply(JSON.stringify({ title: "Cancelled", body: "Cancelled due to rain." })));
    const res = await post({ title: "雨天中止", body: "雨天のため中止です" });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, titleEn: "Cancelled", bodyEn: "Cancelled due to rain." });
    const params = requestChatCompletion.mock.calls[0][2] as { messages: { role: string; content: string }[] };
    expect(params.messages[1].content).toContain("雨天中止");
  });

  it("管理者でなければ AI を呼ばない", async () => {
    guard.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    expect((await post({ title: "a", body: "b" })).status).toBe(403);
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("タイトルか本文が空・長すぎるなら 400", async () => {
    for (const body of [{}, { title: "a" }, { title: "a", body: " " }, { title: "あ".repeat(81), body: "b" }]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("キー未設定は 503、AI の失敗・読めない返事は 502", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect((await post({ title: "a", body: "b" })).status).toBe(503);
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    requestChatCompletion.mockResolvedValueOnce({ ok: false });
    expect((await post({ title: "a", body: "b" })).status).toBe(502);
    requestChatCompletion.mockResolvedValueOnce(aiReply(JSON.stringify({ title: "only" })));
    expect((await post({ title: "a", body: "b" })).status).toBe(502);
  });
});
