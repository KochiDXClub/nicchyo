import { describe, expect, it } from "vitest";
import {
  SHOP_PERMISSION_KEYS,
  SHOP_PERMISSION_META,
  SHOP_PERMISSION_PRESETS,
  hasShopPermission,
  parseShopPermissions,
} from "./shopPermissions";

describe("parseShopPermissions", () => {
  it("知らないキーは無視し、重複を除いて定義順に並べる", () => {
    expect(parseShopPermissions(["post", "nope", "store_edit", "post"])).toEqual(["store_edit", "post"]);
  });

  it("配列でなければ null", () => {
    expect(parseShopPermissions("post")).toBeNull();
    expect(parseShopPermissions(undefined)).toBeNull();
  });
});

describe("hasShopPermission", () => {
  it("代表者は permissions が空でも全権限", () => {
    expect(hasShopPermission({ role: "owner", permissions: [] }, "members_manage")).toBe(true);
  });

  it("メンバーは付けた権限だけ", () => {
    const m = { role: "member", permissions: ["post"] } as const;
    expect(hasShopPermission(m, "post")).toBe(true);
    expect(hasShopPermission(m, "store_edit")).toBe(false);
  });

  it("所属なしは常に false", () => {
    expect(hasShopPermission(null, "post")).toBe(false);
  });
});

describe("権限の定義", () => {
  it("すべてのキーに表示名がある", () => {
    for (const key of SHOP_PERMISSION_KEYS) {
      expect(SHOP_PERMISSION_META[key].label).not.toBe("");
    }
  });

  it("ひな形は知っているキーだけを含む", () => {
    for (const preset of Object.values(SHOP_PERMISSION_PRESETS)) {
      for (const key of preset.permissions) {
        expect(SHOP_PERMISSION_KEYS).toContain(key);
      }
    }
  });
});
