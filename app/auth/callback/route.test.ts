import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { exchange, getUser, getCookie } = vi.hoisted(() => ({ exchange: vi.fn(), getUser: vi.fn(), getCookie: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: getCookie }) }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => ({ auth: { exchangeCodeForSession: exchange, getUser } }) }));
import { GET } from "./route";

beforeEach(() => { vi.clearAllMocks(); exchange.mockResolvedValue({ error: null }); getUser.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } }, error: null }); });

describe("Google OAuth callback", () => {
  it("exchanges the code before redirecting an admin and prevents caching", async () => {
    const response = await GET(new NextRequest("https://example.com/auth/callback?code=valid"));
    expect(exchange).toHaveBeenCalledWith("valid");
    expect(response.headers.get("location")).toBe("https://example.com/admin/dashboard");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("resumes a valid invitation and clears its cookie", async () => {
    getCookie.mockReturnValue({ value: "/join/abc_123" });
    const response = await GET(new NextRequest("https://example.com/auth/callback?code=valid"));
    expect(response.headers.get("location")).toBe("https://example.com/join/abc_123");
    expect(response.cookies.get("nicchyo_oauth_return")?.value).toBe("");
  });
  it.each(["//evil.example", "/\\evil.example", "/join/%2f%2fevil", "/join/a?next=https://evil.example", "/join/../admin"])("rejects an unsafe return path %s", async (path) => {
    getCookie.mockReturnValue({ value: path });
    const response = await GET(new NextRequest("https://example.com/auth/callback?code=valid"));
    expect(response.headers.get("location")).toBe("https://example.com/admin/dashboard");
  });
  it.each([["vendor", "/my-shop"], ["general_user", "/map"], ["city_official", "/city"]])("routes %s after authentication", async (role, path) => {
    getUser.mockResolvedValue({ data: { user: { app_metadata: { role } } }, error: null });
    const response = await GET(new NextRequest("https://example.com/auth/callback?code=valid"));
    expect(response.headers.get("location")).toBe(`https://example.com${path}`);
  });
  it("returns to login without exchanging a missing code", async () => {
    const response = await GET(new NextRequest("https://example.com/auth/callback?error=access_denied"));
    expect(response.headers.get("location")).toBe("https://example.com/login?error=oauth");
    expect(exchange).not.toHaveBeenCalled();
  });
  it("returns to login without exposing errors or accepting a return path on failure", async () => {
    exchange.mockResolvedValue({ error: { message: "sensitive" } });
    const response = await GET(new NextRequest("https://example.com/auth/callback?code=bad"));
    expect(response.headers.get("location")).toBe("https://example.com/login?error=oauth");
    expect(getUser).not.toHaveBeenCalled();
  });
});
