// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DB_GUARD = () => {
  throw new Error("入力検証で弾く前に DB へ触ってはいけない");
};
const createClient = vi.fn(DB_GUARD);

vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => createClient() }));
vi.mock("@/lib/grandma/abuseDetection", () => ({ handleAbuseDetection: async () => "ok" }));
vi.mock("@/lib/grandma/vendorSearch", () => ({
  fetchShopsByVendorIds: async () => [],
  summarizeShops: () => "",
}));
vi.mock("@/lib/ai/modelStore.server", () => ({
  resolveAiModelFor: async () => ({ def: { id: "test", provider: "openai" } }),
}));

const requestEmbeddings = vi.fn();
const requestChatCompletion = vi.fn();
vi.mock("@/lib/ai/openaiFetch", () => ({
  requestEmbeddings: (...args: unknown[]) => requestEmbeddings(...args),
  requestChatCompletion: (...args: unknown[]) => requestChatCompletion(...args),
}));

import { POST } from "./route";

function post(body: string) {
  return POST(
    new Request("http://localhost/api/grandma/itinerary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    })
  );
}

describe("POST /api/grandma/itinerary の入力検証", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("壊れた JSON は 500 でなく 400", async () => {
    const res = await post("{broken");
    expect(res.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("POST /api/grandma/itinerary のタイムアウト", () => {
  const timeoutError = () => new DOMException("The operation was aborted due to timeout", "TimeoutError");
  const okEmbedding = () =>
    new Response(JSON.stringify({ data: [{ embedding: [0.1, 0.2] }] }), { status: 200 });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    createClient.mockImplementation(
      () => ({ rpc: () => ({ returns: async () => ({ data: [] }) }) }) as never
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    createClient.mockImplementation(DB_GUARD);
  });

  it("埋め込みが打ち切られたら、埋め込みの失敗と同じ返し方にし、旅程の呼び出しには進まない", async () => {
    requestEmbeddings.mockImplementation(async (_key, _input, signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      throw timeoutError();
    });

    const res = await post(JSON.stringify({ interest: "文旦" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "embedding failed" });
    expect(requestChatCompletion).not.toHaveBeenCalled();
  });

  it("旅程の呼び出しが打ち切られたら、呼び出しの失敗と同じ返し方にする", async () => {
    requestEmbeddings.mockResolvedValue(okEmbedding());
    requestChatCompletion.mockImplementation(async (_key, _model, _params, signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal);
      throw timeoutError();
    });

    const res = await post(JSON.stringify({ interest: "文旦" }));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "chat completion failed" });
  });
});
