// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createServiceClient = vi.fn((..._args: unknown[]) => ({ __service: true }));

vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => ({ auth: { getUser } })),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createServiceClient(...args),
}));

import {
  authorizeAdmin,
  createAdminServiceClientOrNull,
  requireAdminApi,
} from "./requireAdminApi";

const adminUser = { id: "a", app_metadata: { role: "admin" } };
const moderatorUser = { id: "m", app_metadata: { role: "moderator" } };
const forgedUser = { id: "f", app_metadata: {}, user_metadata: { role: "admin" } };

beforeEach(() => {
  getUser.mockReset();
  createServiceClient.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
});

describe("requireAdminApi", () => {
  it("未認証は 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await requireAdminApi();
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("admin 以外（moderator・user_metadata だけ admin）は 401 で service client を作らない", async () => {
    for (const user of [moderatorUser, forgedUser]) {
      getUser.mockResolvedValue({ data: { user } });
      const result = await requireAdminApi();
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(401);
    }
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("admin は user・role・adminClient を返す", async () => {
    getUser.mockResolvedValue({ data: { user: adminUser } });
    const result = await requireAdminApi();
    expect("error" in result).toBe(false);
    if (!("error" in result)) {
      expect(result.user).toBe(adminUser);
      expect(result.role).toBe("admin");
      expect(result.adminClient).toBeDefined();
    }
  });

  it("admin でも service role の env が無ければ例外（フェイルクローズ）", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    getUser.mockResolvedValue({ data: { user: adminUser } });
    await expect(requireAdminApi()).rejects.toThrow();
  });
});

describe("authorizeAdmin", () => {
  it("未認証・非 admin は Forbidden", async () => {
    for (const user of [null, moderatorUser, forgedUser]) {
      getUser.mockResolvedValue({ data: { user } });
      expect(await authorizeAdmin()).toEqual({ user: null, error: "Forbidden" });
    }
  });

  it("admin は user を返し error は null", async () => {
    getUser.mockResolvedValue({ data: { user: adminUser } });
    expect(await authorizeAdmin()).toEqual({ user: adminUser, error: null });
  });
});

describe("createAdminServiceClientOrNull", () => {
  it("env が揃っていればクライアント、欠けていれば null", () => {
    expect(createAdminServiceClientOrNull()).not.toBeNull();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(createAdminServiceClientOrNull()).toBeNull();
  });
});
