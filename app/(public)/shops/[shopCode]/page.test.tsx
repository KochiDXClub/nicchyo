import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
const legacy = vi.hoisted(() => vi.fn());
const profiles = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn(() => { throw new Error("redirected"); }));
vi.mock("@/lib/shops/publicIdentity.server", () => ({ readPublicLegacyIdentities: legacy }));
vi.mock("next/navigation", () => ({ redirect, notFound: () => { throw new Error("not found"); } }));
vi.mock("../../map/services/shopCache", () => ({ fetchPublicShopProfiles: profiles }));
vi.mock("@/lib/i18n/server", () => ({ getLocale: vi.fn().mockResolvedValue("ja") }));
vi.mock("./ShopPageBanner", () => ({ default: ({ shop }: { shop: { name: string; hasMapLocation: boolean } }) => <div>{shop.name}・{shop.hasMapLocation ? "地図あり" : "地図なし"}</div> }));
vi.mock("./ReportButton", () => ({ default: () => null }));
import ShopPage from "./page";
describe("旧店舗URL", () => {
  it("確認済みの旧番号を固定URLへ移す", async () => {
    legacy.mockResolvedValue({ enabled: true, aliases: { "12": 1001 } });
    await expect(ShopPage({ params: Promise.resolve({ shopCode: "012" }) })).rejects.toThrow("redirected");
    expect(redirect).toHaveBeenCalledWith("/shops/1001");
  });
  it("出店予定がない公開店舗も店舗ページを表示する", async () => {
    profiles.mockResolvedValue([{ id: 1001, name: "八百屋", hasMapLocation: false, nextMarketStatus: "not_scheduled", products: [] }]);
    render(await ShopPage({ params: Promise.resolve({ shopCode: "1001" }) }));
    expect(screen.getByText("八百屋・地図なし")).toBeInTheDocument();
  });
});
