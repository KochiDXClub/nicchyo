import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/requireAdminApi", () => ({ requireAdminApi: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/i18n/shopTranslation.server", () => ({ syncShopTranslations: vi.fn() }));
vi.mock("@/app/(public)/map/services/shopCache", () => ({ fetchPublicShops: vi.fn() }));

import { syncShopTranslations } from "@/lib/i18n/shopTranslation.server";
import { fetchPublicShops } from "@/app/(public)/map/services/shopCache";
import { GET } from "./route";

function request(authorization?: string) {
  return new NextRequest("https://nicchyo.jp/api/admin/shop-translations", {
    headers: authorization ? { authorization } : {},
  });
}

describe("店舗翻訳の Cron", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([undefined, "Bearer wrong-secret"])("認証が無効なら翻訳を実行しない: %s", async (authorization) => {
    const response = await GET(request(authorization));
    expect(response.status).toBe(401);
    expect(fetchPublicShops).not.toHaveBeenCalled();
    expect(syncShopTranslations).not.toHaveBeenCalled();
  });

  it("CRON_SECRET が未設定なら実行しない", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request("Bearer test-cron-secret"))).status).toBe(401);
    expect(syncShopTranslations).not.toHaveBeenCalled();
  });

  it("正しい認証なら公開店舗を30件上限で英訳し、結果を返す", async () => {
    vi.mocked(fetchPublicShops).mockResolvedValue([]);
    const result = { locale: "en" as const, pending: 40, translated: 30, failed: 0 };
    vi.mocked(syncShopTranslations).mockResolvedValue(result);
    const response = await GET(request("Bearer test-cron-secret"));
    expect(fetchPublicShops).toHaveBeenCalledWith();
    expect(syncShopTranslations).toHaveBeenCalledExactlyOnceWith({ shops: [], locale: "en", limit: 30 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, results: [result] });
  });
});
