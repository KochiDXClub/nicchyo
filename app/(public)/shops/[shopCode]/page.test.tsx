import { describe, expect, it, vi } from "vitest";
const legacy = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn(() => { throw new Error("redirected"); }));
vi.mock("@/lib/shops/publicIdentity.server", () => ({ readPublicLegacyIdentities: legacy }));
vi.mock("next/navigation", () => ({ redirect, notFound: () => { throw new Error("not found"); } }));
vi.mock("../../map/services/shopCache", () => ({ fetchPublicShops: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn().mockResolvedValue("ja") }));
import ShopPage from "./page";
describe("旧店舗URL", () => {
  it("確認済みの旧番号を固定URLへ移す", async () => {
    legacy.mockResolvedValue({ enabled: true, aliases: { "12": 1001 } });
    await expect(ShopPage({ params: Promise.resolve({ shopCode: "012" }) })).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith("/shops/1001");
  });
});
