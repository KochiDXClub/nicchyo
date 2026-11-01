import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => ({ auth: { getUser: async () => ({ data: { user: { app_metadata: { role: "admin" } } } }) } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ from: () => ({ upsert }) }) }));
vi.mock("@/lib/security/requestGuards", () => ({ requireSameOrigin: () => ({ ok: true }) }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));
import { PUT } from "./route";
describe("公開範囲の保存環境", () => {
  afterEach(() => { vi.unstubAllEnvs(); upsert.mockClear(); });
  it.each(["preview", "production"])("%s からの保存で本番の公開設定を保護する", async (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
    const response = await PUT(new NextRequest("https://example.com/api/admin/settings", { method: "PUT", body: JSON.stringify({ pageVisibility: { pages: { "/map": { roles: { anon: "public" } } } } }) }));
    expect(response.status).toBe(environment === "preview" ? 403 : 200);
    expect(upsert).toHaveBeenCalledTimes(environment === "preview" ? 0 : 1);
  });
});
