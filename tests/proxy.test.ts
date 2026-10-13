import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  getResponse: vi.fn(),
  getUser: vi.fn(),
}));

vi.mock("@/utils/supabase/middleware", () => ({
  createClient: () => ({
    supabase: { auth: { getUser: mocks.getUser } },
    getResponse: mocks.getResponse,
  }),
}));

const SUPABASE_URL = "https://example.supabase.co";

function settingsResponse(maintenance: boolean) {
  const rows = [{ key: "public", value: { maintenanceMode: maintenance, maintenanceMessage: "m" } }];
  return new Response(JSON.stringify(rows), { status: 200 });
}

async function loadProxy() {
  vi.resetModules();
  return import("@/proxy");
}

const req = (path: string) => new NextRequest(new URL(path, "https://nicchyo.test"));

describe("proxy", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "anon");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    mocks.getUser.mockReset().mockResolvedValue({ data: { user: null } });
    mocks.getResponse.mockReset().mockImplementation(() => NextResponse.next());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("Cookie 転写", () => {
    it("リフレッシュ後 Cookie の options を通常レスポンスへ引き継ぐ", async () => {
      fetchMock.mockResolvedValue(settingsResponse(false));
      const refreshed = NextResponse.next();
      refreshed.cookies.set("sb-token", "v", {
        maxAge: 3600,
        path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      });
      mocks.getResponse.mockReturnValue(refreshed);

      const { proxy } = await loadProxy();
      const res = await proxy(req("/map"));
      expect(res.cookies.get("sb-token")).toMatchObject({
        value: "v",
        maxAge: 3600,
        path: "/",
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      });
    });

    it("リダイレクト応答にも options を引き継ぐ", async () => {
      fetchMock.mockResolvedValue(settingsResponse(false));
      const refreshed = NextResponse.next();
      refreshed.cookies.set("sb-token", "v", { maxAge: 100, path: "/", secure: true });
      mocks.getResponse.mockReturnValue(refreshed);

      const { proxy } = await loadProxy();
      const res = await proxy(req("/admin"));
      expect(res.status).toBe(307);
      expect(res.cookies.get("sb-token")).toMatchObject({ maxAge: 100, secure: true });
    });
  });

  describe("サイト設定の取得", () => {
    it("fetch にタイムアウト用 signal を渡す", async () => {
      fetchMock.mockResolvedValue(settingsResponse(false));
      const { proxy } = await loadProxy();
      await proxy(req("/map"));
      expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    });

    it("失敗時は期限切れでも直近の成功値（メンテ有効）を使う", async () => {
      fetchMock.mockResolvedValueOnce(settingsResponse(true));
      const { proxy } = await loadProxy();
      const first = await proxy(req("/map"));
      expect(first.headers.get("x-middleware-rewrite")).toContain("/maintenance");

      vi.advanceTimersByTime(61_000);
      fetchMock.mockRejectedValueOnce(new Error("timeout"));
      const second = await proxy(req("/map"));
      expect(second.headers.get("x-middleware-rewrite")).toContain("/maintenance");
    });

    it("失敗しても短TTLでキャッシュし、毎リクエスト再取得しない", async () => {
      fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
      const { proxy } = await loadProxy();
      await proxy(req("/map"));
      await proxy(req("/map"));
      await proxy(req("/search"));
      expect(fetchMock).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(11_000);
      await proxy(req("/map"));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("初回から失敗した場合は従来どおりメンテ無効で通す", async () => {
      fetchMock.mockRejectedValue(new Error("down"));
      const { proxy } = await loadProxy();
      const res = await proxy(req("/map"));
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    });
  });

  describe("メンテナンスモード", () => {
    it("通常ページは /maintenance に rewrite される", async () => {
      fetchMock.mockResolvedValue(settingsResponse(true));
      const { proxy } = await loadProxy();
      const res = await proxy(req("/map"));
      expect(res.headers.get("x-middleware-rewrite")).toContain("/maintenance");
    });

    it.each(["/login", "/oauth/consent", "/admin", "/api/shops"])(
      "%s はメンテ中でも rewrite されない",
      async (path) => {
        fetchMock.mockResolvedValue(settingsResponse(true));
        const { proxy } = await loadProxy();
        const res = await proxy(req(path));
        expect(res.headers.get("x-middleware-rewrite")).toBeNull();
      }
    );

    it("/loginfoo のような前方一致の別パスはメンテ対象のまま", async () => {
      fetchMock.mockResolvedValue(settingsResponse(true));
      const { proxy } = await loadProxy();
      const res = await proxy(req("/loginfoo"));
      expect(res.headers.get("x-middleware-rewrite")).toContain("/maintenance");
    });
  });

  describe("matcher", () => {
    async function matches(path: string) {
      const { config } = await loadProxy();
      return new RegExp(`^${config.matcher[0]}$`).test(path);
    }

    it.each(["/", "/map", "/shops/001", "/api/shops", "/api/analyticsx", "/imagesfoo"])(
      "%s は proxy を通す",
      async (path) => {
        expect(await matches(path)).toBe(true);
      }
    );

    it.each([
      "/api/analytics/page-visit",
      "/api/analytics/shop-view",
      "/images/shops/a.webp",
      "/logo.png",
      "/fonts/a.woff2",
      "/_next/static/chunk.js",
      "/favicon.ico",
    ])("%s は proxy を通さない", async (path) => {
      expect(await matches(path)).toBe(false);
    });
  });
});
