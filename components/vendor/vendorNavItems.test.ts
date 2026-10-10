import { describe, expect, it } from "vitest";
import { requiredPermissionForPath, visibleVendorNavItems } from "./vendorNavItems";

describe("requiredPermissionForPath", () => {
  it("導線のある画面は、導線に付けた権限（下の階層も同じ）", () => {
    expect(requiredPermissionForPath("/vendor/inquiries")).toBe("inquiries");
    expect(requiredPermissionForPath("/vendor/inquiries/new")).toBe("inquiries");
    expect(requiredPermissionForPath("/vendor/posts")).toBe("post");
    expect(requiredPermissionForPath("/vendor/analytics")).toBe("analytics");
    expect(requiredPermissionForPath("/vendor/store")).toBe("store_edit");
  });

  it("モック段階のキャラクター設定は導線に出さず、URL で開いたときだけ ai_notes を求める", () => {
    expect(visibleVendorNavItems(() => true).map((item) => item.href)).not.toContain("/vendor/character");
    expect(requiredPermissionForPath("/vendor/character")).toBe("ai_notes");
  });

  it("導線のないマイ店舗の店舗情報まわりの画面は store_edit", () => {
    expect(requiredPermissionForPath("/my-shop/schedule")).toBe("store_edit");
    expect(requiredPermissionForPath("/my-shop/detail")).toBe("store_edit");
    expect(requiredPermissionForPath("/my-shop/ask")).toBe("store_edit");
  });

  it("権限の要らない画面（ホーム・使い方・アカウント設定）や、名前が似ているだけの画面は undefined", () => {
    for (const path of ["/my-shop", "/vendor/help", "/vendor/account", "/vendor/storefront", "/vendor/postscript", null]) {
      expect(requiredPermissionForPath(path)).toBeUndefined();
    }
  });
});

describe("visibleVendorNavItems", () => {
  it("権限のある導線と、権限の要らない導線だけを返す", () => {
    const labels = visibleVendorNavItems((key) => key === "analytics").map((item) => item.label);
    expect(labels).toContain("お店の分析");
    expect(labels).toContain("アカウント設定");
    expect(labels).not.toContain("近況を出す");
  });
});
