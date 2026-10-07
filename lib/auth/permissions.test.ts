// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import {
  getRole,
  isAdmin,
  isModerator,
  isVendor,
  normalizeRole,
  requireVendorRole,
} from "./permissions";

describe("getRole", () => {
  it("app_metadata.role を返す", () => {
    expect(getRole({ app_metadata: { role: "admin" } })).toBe("admin");
  });

  it("user_metadata にロールがあっても無視する（改ざん可能なため）", () => {
    expect(getRole({ user_metadata: { role: "admin" } })).toBeNull();
    expect(
      getRole({ app_metadata: { role: "vendor" }, user_metadata: { role: "admin" } }),
    ).toBe("vendor");
  });

  it("user / app_metadata が無い・不正な入力では null", () => {
    expect(getRole(null)).toBeNull();
    expect(getRole(undefined)).toBeNull();
    expect(getRole("admin")).toBeNull();
    expect(getRole({})).toBeNull();
    expect(getRole({ app_metadata: {} })).toBeNull();
  });
});

describe("isAdmin / isModerator / isVendor", () => {
  it("isAdmin は admin だけ", () => {
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("moderator")).toBe(false);
    expect(isAdmin("vendor")).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });

  it("isModerator は moderator と admin だけ", () => {
    expect(isModerator("admin")).toBe(true);
    expect(isModerator("moderator")).toBe(true);
    expect(isModerator("vendor")).toBe(false);
    expect(isModerator("general_user")).toBe(false);
    expect(isModerator(null)).toBe(false);
  });

  it("isVendor は vendor だけ（admin は含まない）", () => {
    expect(isVendor("vendor")).toBe(true);
    expect(isVendor("admin")).toBe(false);
    expect(isVendor(null)).toBe(false);
  });
});

describe("normalizeRole", () => {
  it("既知のロールはそのまま返す", () => {
    expect(normalizeRole("admin")).toBe("admin");
    expect(normalizeRole("moderator")).toBe("moderator");
    expect(normalizeRole("vendor")).toBe("vendor");
  });

  it("未知・空・大文字違いは general_user に落とす", () => {
    expect(normalizeRole("general_user")).toBe("general_user");
    expect(normalizeRole("superuser")).toBe("general_user");
    expect(normalizeRole("Admin")).toBe("general_user");
    expect(normalizeRole("")).toBe("general_user");
    expect(normalizeRole(null)).toBe("general_user");
    expect(normalizeRole(undefined)).toBe("general_user");
  });
});

describe("requireVendorRole", () => {
  const userWith = (appRole?: string, userRole?: string) =>
    ({
      app_metadata: appRole ? { role: appRole } : {},
      user_metadata: userRole ? { role: userRole } : {},
    }) as unknown as User;

  it("vendor なら null（通過）", () => {
    expect(requireVendorRole(userWith("vendor"))).toBeNull();
  });

  it("vendor 以外は 403", async () => {
    for (const role of ["admin", "moderator", "general_user", undefined]) {
      const res = requireVendorRole(userWith(role));
      expect(res?.status).toBe(403);
      expect(await res?.json()).toEqual({ error: "Forbidden" });
    }
  });

  it("user_metadata が vendor でも通さない", () => {
    expect(requireVendorRole(userWith(undefined, "vendor"))?.status).toBe(403);
  });
});
