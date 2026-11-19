// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestEmbeddings = vi.fn();
const insert = vi.fn();

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/vendor/shopContext.server", () => ({
  requireVendorContext: async () => ({ ok: true, vendorId: "shop-1" }),
}));
vi.mock("@/lib/ai/openaiFetch", () => ({
  requestEmbeddings: (...args: unknown[]) => requestEmbeddings(...args),
}));
/** 既存のメモは無い（insert に進む） */
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ single: async () => ({ data: null }) }) }) }) }),
      insert: async (row: unknown) => (insert(row), { error: null }),
    }),
  }),
}));

import { POST } from "./route";

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/vendor/knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );

describe("POST /api/vendor/knowledge の埋め込みのタイムアウト", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
  });

  it("埋め込みが打ち切られても、埋め込みの失敗と同じくメモは保存する（探せない印のまま）", async () => {
    requestEmbeddings.mockImplementation(async (_key, _input, signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });

    const res = await post({ content: "雨の日も出ています" });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, hasEmbedding: false });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ content: "雨の日も出ています", embedding: null }));
  });
});
