import { describe, expect, it } from "vitest";
import { findRegistryEntry, PAGE_REGISTRY } from "./registry";
import {
  isLinkVisible,
  isSafeRedirectPath,
  parsePageVisibilitySettings,
  resolvePageVisibility,
  toVisibilityRole,
} from "./resolve";
import type { PageVisibilitySettings } from "./types";

const settings: PageVisibilitySettings = {
  pages: {
    "/consult": { roles: { anon: "unlisted", general_user: "private" }, redirectTo: "/map" },
    "/shops": { roles: { anon: "private" } },
  },
};

describe("findRegistryEntry", () => {
  it("完全一致と前方一致でヒットする", () => {
    expect(findRegistryEntry("/shops")?.path).toBe("/shops");
    expect(findRegistryEntry("/shops/001")?.path).toBe("/shops");
  });

  it("最長一致を優先する", () => {
    expect(findRegistryEntry("/vendor/posts/123")?.path).toBe("/vendor/posts");
    expect(findRegistryEntry("/vendor/post/new")?.path).toBe("/vendor/post");
  });

  it("未登録パスは null", () => {
    expect(findRegistryEntry("/login")).toBeNull();
    expect(findRegistryEntry("/shopsxyz")).toBeNull();
  });

  it("レジストリのパスは重複しない", () => {
    const paths = PAGE_REGISTRY.map((e) => e.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

describe("resolvePageVisibility", () => {
  it("設定が無いページは public", () => {
    const r = resolvePageVisibility("/search", "anon", settings);
    expect(r.state).toBe("public");
    expect(r.redirectTo).toBe("/");
  });

  it("ロール別の設定とリダイレクト先を返す", () => {
    expect(resolvePageVisibility("/consult", "anon", settings).state).toBe("unlisted");
    const r = resolvePageVisibility("/consult", "general_user", settings);
    expect(r.state).toBe("private");
    expect(r.redirectTo).toBe("/map");
    expect(resolvePageVisibility("/consult", "vendor", settings).state).toBe("public");
  });

  it("サブパスにも設定が効く", () => {
    expect(resolvePageVisibility("/shops/042", "anon", settings).state).toBe("private");
  });

  it("管理者は常に public", () => {
    const strict: PageVisibilitySettings = { pages: { "/consult": { roles: { admin: "private" } } } };
    expect(resolvePageVisibility("/consult", "admin", strict).state).toBe("public");
  });

  it("コード側ゲートは設定で緩められない", () => {
    const loose: PageVisibilitySettings = { pages: { "/admin/users": { roles: {} } } };
    expect(resolvePageVisibility("/admin/users", "anon", loose).state).toBe("private");
    expect(resolvePageVisibility("/my-shop", "general_user", loose).state).toBe("private");
    expect(resolvePageVisibility("/my-shop", "vendor", loose).state).toBe("public");
    expect(resolvePageVisibility("/moderator", "moderator", loose).state).toBe("public");
  });

  it("lockedPublic のページは private にできない", () => {
    const locked: PageVisibilitySettings = { pages: { "/map": { roles: { anon: "private" } } } };
    expect(resolvePageVisibility("/map", "anon", locked).state).toBe("public");
  });

  it("未登録パスは常に public", () => {
    expect(resolvePageVisibility("/login", "anon", settings).state).toBe("public");
  });
});

describe("isLinkVisible", () => {
  it("public のときだけ true", () => {
    expect(isLinkVisible("/consult", "anon", settings)).toBe(false);
    expect(isLinkVisible("/consult", "vendor", settings)).toBe(true);
  });
});

describe("parsePageVisibilitySettings", () => {
  it("不正な値は空設定にする", () => {
    expect(parsePageVisibilitySettings(null)).toEqual({ pages: {} });
    expect(parsePageVisibilitySettings({ pages: "x" })).toEqual({ pages: {} });
  });

  it("未登録パス・不正ロール・不正状態・public を捨てる", () => {
    const parsed = parsePageVisibilitySettings({
      pages: {
        "/nope": { roles: { anon: "private" } },
        "/shops/001": { roles: { anon: "private" } },
        "/consult": { roles: { anon: "public", vendor: "weird", hacker: "private", general_user: "unlisted" } },
      },
    });
    expect(parsed).toEqual({ pages: { "/consult": { roles: { general_user: "unlisted" } } } });
  });

  it("redirectTo はサイト内パスのみ受け付け、デフォルトは省略する", () => {
    const parsed = parsePageVisibilitySettings({
      pages: {
        "/consult": { roles: { anon: "private" }, redirectTo: "https://evil.example" },
        "/shops": { roles: { anon: "private" }, redirectTo: "/" },
        "/story": { roles: { anon: "private" }, redirectTo: "/map" },
      },
    });
    expect(parsed.pages["/consult"].redirectTo).toBeUndefined();
    expect(parsed.pages["/shops"].redirectTo).toBeUndefined();
    expect(parsed.pages["/story"].redirectTo).toBe("/map");
  });
});

describe("isSafeRedirectPath", () => {
  it("「/」またはレジストリ登録済みパスのみ許可", () => {
    expect(isSafeRedirectPath("/")).toBe(true);
    expect(isSafeRedirectPath("/map")).toBe(true);
    expect(isSafeRedirectPath("/shops/001")).toBe(true);
    expect(isSafeRedirectPath("/news")).toBe(false);
    expect(isSafeRedirectPath("//evil.example")).toBe(false);
    expect(isSafeRedirectPath("/\\evil.example")).toBe(false);
    expect(isSafeRedirectPath("/\t/evil.example")).toBe(false);
    expect(isSafeRedirectPath("/\n/evil.example")).toBe(false);
    expect(isSafeRedirectPath("map")).toBe(false);
    expect(isSafeRedirectPath("https://evil.example")).toBe(false);
  });
});

describe("toVisibilityRole", () => {
  it("未ログインは anon、未知のロールは general_user", () => {
    expect(toVisibilityRole(null, false)).toBe("anon");
    expect(toVisibilityRole("admin", false)).toBe("anon");
    expect(toVisibilityRole("vendor", true)).toBe("vendor");
    expect(toVisibilityRole("something", true)).toBe("general_user");
  });
});
