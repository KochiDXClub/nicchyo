import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  ADMIN_NAV_GROUPS,
  getAllAdminNavItems,
  getVisibleAdminNav,
  isAdminNavItemActive,
} from "./adminNav";
import type { PermissionCheck } from "@/lib/auth/types";

const ADMIN_PAGES_DIR = path.join(process.cwd(), "app", "(public)", "admin");

/**
 * ナビに載せない管理ページ。
 * 旧URLのリダイレクトなど、意図して導線を持たないものだけをここに書く。
 * 新しい管理ページを追加したのにナビへ載せ忘れると、このテストが落ちる。
 */
const PATHS_INTENTIONALLY_NOT_IN_NAV = new Set([
  "/admin", // /admin/dashboard へのリダイレクト
]);

/** app/(public)/admin 配下の page.tsx から実在するルートを列挙する */
function listAdminRoutes(dir: string, prefix = "/admin"): string[] {
  const routes: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // [date] のような動的セグメントは親ページから辿るのでナビ対象外
      if (entry.name.startsWith("[") || entry.name === "components") continue;
      routes.push(...listAdminRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`));
    } else if (entry.name === "page.tsx") {
      routes.push(prefix);
    }
  }
  return routes;
}

const adminPermissions: PermissionCheck = {
  isAdmin: true,
  isModerator: true,
  canModerateContent: true,
} as PermissionCheck;

const moderatorPermissions: PermissionCheck = {
  isAdmin: false,
  isModerator: true,
  canModerateContent: true,
} as PermissionCheck;

describe("adminNav", () => {
  it("href が重複していない", () => {
    const hrefs = getAllAdminNavItems().map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("すべての項目が /admin 配下を指している", () => {
    for (const item of getAllAdminNavItems()) {
      expect(item.href.startsWith("/admin/")).toBe(true);
    }
  });

  it("すべての項目に一行説明がある", () => {
    for (const item of getAllAdminNavItems()) {
      expect(item.description.length).toBeGreaterThan(0);
    }
  });

  it("実在する管理ページはすべてナビに載っている", () => {
    const routes = listAdminRoutes(ADMIN_PAGES_DIR).filter(
      (route) => !PATHS_INTENTIONALLY_NOT_IN_NAV.has(route)
    );
    const navHrefs = new Set(getAllAdminNavItems().map((item) => item.href));
    const missing = routes.filter((route) => !navHrefs.has(route));
    expect(missing).toEqual([]);
  });

  it("ナビの項目はすべて実在するページを指している", () => {
    const routes = new Set(listAdminRoutes(ADMIN_PAGES_DIR));
    const dangling = getAllAdminNavItems()
      .map((item) => item.href)
      .filter((href) => !routes.has(href));
    expect(dangling).toEqual([]);
  });

  it("管理者にはすべてのグループが見える", () => {
    expect(getVisibleAdminNav(adminPermissions)).toHaveLength(ADMIN_NAV_GROUPS.length);
  });

  it("モデレーターには担当グループだけが見える", () => {
    const groups = getVisibleAdminNav(moderatorPermissions);
    expect(groups.map((group) => group.id)).toEqual(["home", "inbox"]);
    // 空のグループが見出しだけ残らない
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("ダッシュボードは /admin でも選択状態になる", () => {
    expect(isAdminNavItemActive("/admin/dashboard", "/admin")).toBe(true);
    expect(isAdminNavItemActive("/admin/dashboard", "/admin/dashboard")).toBe(true);
    expect(isAdminNavItemActive("/admin/dashboard", "/admin/settings")).toBe(false);
  });

  it("サブパスでも親項目が選択状態になる", () => {
    expect(isAdminNavItemActive("/admin/reports", "/admin/reports/123")).toBe(true);
    // 前方一致だけで誤判定しない
    expect(isAdminNavItemActive("/admin/reports", "/admin/reports-archive")).toBe(false);
  });
});
