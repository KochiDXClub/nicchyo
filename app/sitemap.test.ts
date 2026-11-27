import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchPublicShops = vi.fn();
const fetchPublicMarketBySlug = vi.fn();

vi.mock("@/app/(public)/map/services/shopCache", () => ({
  fetchPublicShopProfiles: () => fetchPublicShops(),
}));

vi.mock("@/lib/market/publicMarkets.server", () => ({
  fetchPublicMarketBySlug: (slug: string) => fetchPublicMarketBySlug(slug),
}));

vi.mock("@/lib/pageVisibility/server", async () => {
  const { EMPTY_PAGE_VISIBILITY_SETTINGS } = await import("@/lib/pageVisibility");
  return { fetchEffectivePageVisibility: async () => EMPTY_PAGE_VISIBILITY_SETTINGS };
});

import sitemap from "./sitemap";

describe("sitemap", () => {
  beforeEach(() => {
    fetchPublicShops.mockReset();
    fetchPublicMarketBySlug.mockReset().mockResolvedValue(null);
  });

  it("公開店舗（fetchPublicShops）を店舗ID（1000以上）の URL として載せ、旧番号（3桁）は載せない", async () => {
    fetchPublicShops.mockResolvedValue([{ id: 1 }, { id: 350 }, { id: 1000 }, { id: 1999 }]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/shops/1000"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/shops/1999"))).toBe(true);
    expect(urls.some((u) => /\/shops\/(001|350)$/.test(u))).toBe(false);
  });
  it("次の日曜に出店しない公開店舗もサイトマップに残す", async () => {
    fetchPublicShops.mockResolvedValue([{ id: 1001, hasMapLocation: false, nextMarketStatus: "not_scheduled" }]);
    const entries = await sitemap();
    expect(entries.some((entry) => entry.url.endsWith("/shops/1001"))).toBe(true);
  });

  it("公開店舗IDを載せ、不正な番号は載せない", async () => {
    fetchPublicShops.mockResolvedValue([{ id: 0 }, { id: 1000 }, { id: 1.5 }, { id: 2 }]);
    const urls = (await sitemap()).map((entry) => entry.url).filter((u) => u.includes("/shops/"));
    expect(urls).toHaveLength(1);
    expect(urls).toContainEqual(expect.stringMatching(/\/shops\/1000$/));
  });

  it("店舗の取得に失敗しても静的ページは返す", async () => {
    fetchPublicShops.mockRejectedValue(new Error("down"));
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/map"))).toBe(true);
    expect(urls.some((u) => u.includes("/shops/"))).toBe(false);
  });

  it("リダイレクトされる /search は載せない（/news はお知らせ一覧として載せる）", async () => {
    fetchPublicShops.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => u.endsWith("/news"))).toBe(true);
    expect(urls.some((u) => u.endsWith("/search"))).toBe(false);
  });

  it("トップページ（紹介ページ）を載せる", async () => {
    fetchPublicShops.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls.some((u) => /^https?:\/\/[^/]+\/$/.test(u))).toBe(true);
  });

  it("カレンダー・活動記録などの静的ページを載せる", async () => {
    fetchPublicShops.mockResolvedValue([]);
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const path of ["/calendar", "/story", "/activities", "/support", "/about/site", "/about/team"]) {
      expect(urls.some((u) => u.endsWith(path))).toBe(true);
    }
    expect(urls.some((u) => u.includes("/activities/"))).toBe(true);
  });

  it("木曜市は公開されているときだけ載せる", async () => {
    fetchPublicShops.mockResolvedValue([]);
    expect((await sitemap()).some((entry) => entry.url.endsWith("/mokuyo"))).toBe(false);

    fetchPublicMarketBySlug.mockResolvedValue({ slug: "mokuyo" });
    expect((await sitemap()).some((entry) => entry.url.endsWith("/mokuyo"))).toBe(true);
    expect(fetchPublicMarketBySlug).toHaveBeenCalledWith("mokuyo");
  });

  it("静的ページに常に「今」の lastModified を入れない", async () => {
    fetchPublicShops.mockResolvedValue([]);
    const entries = await sitemap();
    expect(entries.every((entry) => entry.lastModified === undefined)).toBe(true);
  });
});
