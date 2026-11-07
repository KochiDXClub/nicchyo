import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchPublicShops = vi.fn();

vi.mock("@/app/(public)/map/services/shopCache", () => ({
  fetchPublicShopProfiles: () => fetchPublicShops(),
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
  it("次の日曜に出店しない公開店舗もサイトマップに残す", async () => {
    fetchPublicShops.mockResolvedValue([{ id: 1001, hasMapLocation: false, nextMarketStatus: "not_scheduled" }]);
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url.endsWith("/shops/1001"))).toBe(true);
  });

  it("公開店舗IDを載せ、不正な番号は載せない", async () => {
    fetchPublicShops.mockResolvedValue([{ id: 0 }, { id: 1000 }, { id: 1.5 }, { id: 2 }]);
    const urls = (await sitemap()).map((entry) => entry.url).filter((u) => u.includes("/shops/"));
    expect(urls).toHaveLength(2);
    expect(urls).toContainEqual(expect.stringMatching(/\/shops\/002$/));
    expect(urls).toContainEqual(expect.stringMatching(/\/shops\/1000$/));
  });

  it("店舗の取得に失敗しても静的ページは返す", async () => {
    fetchPublicShops.mockRejectedValue(new Error("down"));
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/map"))).toBe(true);
    expect(urls.some((u) => u.includes("/shops/"))).toBe(false);
  });

  it("リダイレクトされる /news・/search は載せない", async () => {
    fetchPublicShops.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/news"))).toBe(false);
    expect(urls.some((u) => u.endsWith("/search"))).toBe(false);
  });

  it("トップページ（紹介ページ）を載せる", async () => {
    fetchPublicShops.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => /^https?:\/\/[^/]+\/$/.test(u))).toBe(true);
  });

  it("リダイレクトされる /news は載せず、リダイレクト先や活動記録を載せる", async () => {
    fetchPublicShops.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/news"))).toBe(false);
    for (const path of ["/calendar", "/story", "/activities", "/support"]) {
      expect(urls.some((u) => u.endsWith(path))).toBe(true);
    }
    expect(urls.some((u) => u.includes("/activities/"))).toBe(true);
  });

  it("静的ページに常に「今」の lastModified を入れない", async () => {
    fetchPublicShops.mockResolvedValue([]);
    const entries = await sitemap();
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });
});
