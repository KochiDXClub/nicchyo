import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn(() => ({ kind: "client" })) }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { createAdminClient, createAdminClientOrThrow } from "./adminClient";

describe("adminClient", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    createClient.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("service role キーでセッションを持たないクライアントを作る", () => {
    expect(createAdminClient()).toEqual({ kind: "client" });
    expect(createClient).toHaveBeenCalledWith("https://example.supabase.co", "service-key", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it("env が無ければ createAdminClient は null、OrThrow は例外", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(createAdminClient()).toBeNull();
    expect(() => createAdminClientOrThrow()).toThrow("Supabase service role env vars are missing.");
    expect(createClient).not.toHaveBeenCalled();
  });
});
