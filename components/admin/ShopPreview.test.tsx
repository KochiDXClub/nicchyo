import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { Shop } from "@/app/(public)/map/types/shopData";
vi.mock("@/app/(public)/map/components/ShopBannerHero", () => ({
  ShopBannerHero: ({ shop, bannerImage }: { shop: Shop; bannerImage: string }) => <div data-testid="banner">{shop.name}|{bannerImage}</div>,
  ShopInfoList: () => <div>店舗情報</div>, resolveBannerTheme: () => ({}),
}));
vi.mock("@/lib/shopImages", () => ({ getShopPreviewImage: (shop: Shop) => shop.images?.main ?? "/fallback.png" }));
import { ShopPreview } from "./ShopPreview";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it("許可されていない外部画像は読み込まず、共通バナーで店舗を表示する", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://own.supabase.co");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ shop: { id: "v", shop_name: "店A", listing_status: "allowed", photo_use_allowed: true, shop_image_url: "https://other.supabase.co/storage/a.jpg" } }), { status: 200 })));
  render(<ShopPreview vendorId="v" position={1} onClose={vi.fn()} />);
  expect(await screen.findByTestId("banner")).toHaveTextContent("店A|/fallback.png");
});
