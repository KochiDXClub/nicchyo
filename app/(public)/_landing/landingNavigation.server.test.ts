import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), user: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/supabase/anonClient", () => ({ createAnonClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }) }) }) }));
vi.mock("@/utils/supabase/server", () => ({ createClient: () => ({ auth: { getUser: mocks.user } }) }));
import { canShowOutingSupport } from "./landingNavigation.server";
describe("トップのおでかけサポート入口", () => {
  afterEach(() => vi.resetAllMocks());
  it.each(["public", "unlisted", "private"])("anon=%s のとき公開の場合だけ表示", async state => {
    mocks.read.mockResolvedValue({ data: { value: { pages: { "/facilities": { roles: { anon: state } } } } } });
    mocks.user.mockResolvedValue({ data: { user: null } });
    expect(await canShowOutingSupport()).toBe(state === "public");
  });
  it("検証済み管理者のロールで判定する", async () => {
    mocks.read.mockResolvedValue({ data: { value: { pages: { "/facilities": { roles: { anon: "private", admin: "public" } } } } } });
    mocks.user.mockResolvedValue({ data: { user: { app_metadata: { role: "admin" } } } });
    expect(await canShowOutingSupport()).toBe(true);
  });
  it("設定の取得に失敗したら入口を出さない", async () => {
    mocks.read.mockRejectedValue(new Error("offline"));
    expect(await canShowOutingSupport()).toBe(false);
  });
});
