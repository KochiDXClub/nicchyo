import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchPublicShops = vi.fn();

vi.mock("@/app/(public)/map/services/shopCache", () => ({
  fetchPublicShops: () => fetchPublicShops(),
}));

import sitemap from "./sitemap";

describe("sitemap", () => {
  beforeEach(() => {
    fetchPublicShops.mockReset();
  });

  it("公開店舗（fetchPublicShops）を 3 桁コードの URL として載せる", async () => {
    fetchPublicShops.mockResolvedValue([{ id: 1 }, { id: 350 }, { id: 999 }]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/shops/001"))).toBe(true);
    // 旧実装は store_number 300 までで切っていた
    expect(urls.some((u) => u.endsWith("/shops/350"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/shops/999"))).toBe(true);
  });

  it("MAX_SHOP_ID を超える・不正な店番は載せない", async () => {
    fetchPublicShops.mockResolvedValue([{ id: 0 }, { id: 1000 }, { id: 1.5 }, { id: 2 }]);
    const urls = (await sitemap()).map((entry) => entry.url).filter((u) => u.includes("/shops/"));
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/\/shops\/002$/);
  });

  it("店舗の取得に失敗しても静的ページは返す", async () => {
    fetchPublicShops.mockRejectedValue(new Error("down"));
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/map"))).toBe(true);
    expect(urls.some((u) => u.includes("/shops/"))).toBe(false);
  });
});
