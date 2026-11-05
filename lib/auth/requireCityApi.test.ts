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

import { canAccessCity } from "./permissions";
import { requireCityApi } from "./requireCityApi";

const cityUser = { id: "c", app_metadata: { role: "city_official" } };
const adminUser = { id: "a", app_metadata: { role: "admin" } };
const moderatorUser = { id: "m", app_metadata: { role: "moderator" } };
const vendorUser = { id: "v", app_metadata: { role: "vendor" } };
const forgedUser = { id: "f", app_metadata: {}, user_metadata: { role: "city_official" } };

beforeEach(() => {
  getUser.mockReset();
  createServiceClient.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
});

describe("canAccessCity", () => {
  it("city_official と admin だけ通す", () => {
    expect(canAccessCity("city_official")).toBe(true);
    expect(canAccessCity("admin")).toBe(true);
    for (const role of ["moderator", "vendor", "general_user", "", null]) {
      expect(canAccessCity(role)).toBe(false);
    }
  });
});

describe("requireCityApi", () => {
  it("未認証は 401", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await requireCityApi();
    expect("error" in result).toBe(true);
    if ("error" in result) expect(result.error.status).toBe(401);
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("moderator・vendor・user_metadata だけ city_official は 401 で service client を作らない", async () => {
    for (const user of [moderatorUser, vendorUser, forgedUser]) {
      getUser.mockResolvedValue({ data: { user } });
      const result = await requireCityApi();
      expect("error" in result).toBe(true);
      if ("error" in result) expect(result.error.status).toBe(401);
    }
    expect(createServiceClient).not.toHaveBeenCalled();
  });

  it("city_official / admin は user・role・adminClient を返す", async () => {
    for (const [user, role] of [
      [cityUser, "city_official"],
      [adminUser, "admin"],
    ] as const) {
      getUser.mockResolvedValue({ data: { user } });
      const result = await requireCityApi();
      expect("error" in result).toBe(false);
      if (!("error" in result)) {
        expect(result.user).toBe(user);
        expect(result.role).toBe(role);
        expect(result.adminClient).toBeDefined();
      }
    }
  });
});
