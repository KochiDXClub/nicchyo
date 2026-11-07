import { describe, expect, it, vi } from "vitest";

const { guard, cityAuth, requestChatCompletion } = vi.hoisted(() => ({ guard: vi.fn(), cityAuth: vi.fn(), requestChatCompletion: vi.fn() }));
vi.mock("@/lib/admin/shopApiGuard", () => ({ guardAdminWrite: (...args: unknown[]) => guard(...args) }));
vi.mock("@/lib/auth/requireCityApi", () => ({ requireCityApi: cityAuth }));
vi.mock("@/lib/ai/openaiFetch", () => ({ requestChatCompletion: (...args: unknown[]) => requestChatCompletion(...args) }));
vi.mock("@/lib/ai/modelStore.server", () => ({ resolveAiModelFor: vi.fn() }));
import { POST } from "./route";

describe("高知市のお知らせ翻訳", () => {
  it("市の認可を使い、拒否された場合はAIを呼ばない", async () => {
    guard.mockResolvedValue({ error: new Response(null, { status: 403 }) });
    const result = await POST(new Request("https://example.test", { method: "POST", body: "{}" }));
    expect(result.status).toBe(403);
    expect(guard.mock.calls[0][1]).toMatchObject({ authorize: cityAuth, bucket: "city-announcement-translate" });
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });
});
