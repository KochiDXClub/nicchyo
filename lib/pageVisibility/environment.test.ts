import { describe, expect, it } from "vitest";
import { applyEnvironmentDefaults, normalizeForSave, usesProductionDefaults } from "./environment";
import { parsePageVisibilitySettings, resolvePageVisibility } from "./resolve";
import { EMPTY_PAGE_VISIBILITY_SETTINGS, VISIBILITY_ROLES } from "./types";

describe("usesProductionDefaults", () => {
  it("Vercel の本番か、明示したときだけ true", () => {
    expect(usesProductionDefaults({ VERCEL_ENV: "production" })).toBe(true);
    expect(usesProductionDefaults({ NICCHYO_PRODUCTION_DEFAULTS: "1" })).toBe(true);
    expect(usesProductionDefaults({ VERCEL_ENV: "preview" })).toBe(false);
    expect(usesProductionDefaults({})).toBe(false);
  });
});

describe("本番マップの既定", () => {
  const prod = applyEnvironmentDefaults(EMPTY_PAGE_VISIBILITY_SETTINGS, true);

  it("本番では管理者以外が /map を見られず、管理者は見られる", () => {
    for (const role of VISIBILITY_ROLES) {
      const expected = role === "admin" ? "public" : "private";
      expect(resolvePageVisibility("/map", role, prod).state).toBe(expected);
    }
  });

  it("店舗データを返す他のページも同じ既定で止まる", () => {
    for (const path of ["/search", "/shops/001", "/consult", "/favorites"]) {
      expect(resolvePageVisibility(path, "anon", prod).state).toBe("private");
      expect(resolvePageVisibility(path, "admin", prod).state).toBe("public");
    }
  });

  it("デモマップとトップは本番でも誰でも見られる", () => {
    expect(resolvePageVisibility("/demo/map", "anon", prod).state).toBe("public");
    expect(resolvePageVisibility("/", "anon", prod).state).toBe("public");
  });

  it("Preview・開発では今までどおり全員に公開", () => {
    const dev = applyEnvironmentDefaults(EMPTY_PAGE_VISIBILITY_SETTINGS, false);
    expect(resolvePageVisibility("/map", "anon", dev).state).toBe("public");
    expect(resolvePageVisibility("/search", "anon", dev).state).toBe("public");
  });

  it("管理者が保存したロール別の設定は既定より優先される", () => {
    const stored = parsePageVisibilitySettings({
      pages: { "/map": { roles: { moderator: "public", vendor: "unlisted" } } },
    });
    const effective = applyEnvironmentDefaults(stored, true);
    expect(resolvePageVisibility("/map", "moderator", effective).state).toBe("public");
    expect(resolvePageVisibility("/map", "vendor", effective).state).toBe("unlisted");
    expect(resolvePageVisibility("/map", "anon", effective).state).toBe("private");
  });

  it("設定の取得に失敗して空の設定になっても、本番では閉じたまま", () => {
    const fallback = applyEnvironmentDefaults(parsePageVisibilitySettings(null), true);
    expect(resolvePageVisibility("/map", "anon", fallback).state).toBe("private");
  });
});

describe("normalizeForSave", () => {
  it("本番では既定（private）と同じ値を書かず、public への上書きは残す", () => {
    const saved = normalizeForSave(
      parsePageVisibilitySettings({
        pages: { "/map": { roles: { anon: "private", moderator: "public", vendor: "unlisted" } } },
      }),
      true
    );
    expect(saved.pages["/map"].roles).toEqual({ moderator: "public", vendor: "unlisted" });
  });

  it("Preview からの保存は public の上書きを書かない（本番の既定を緩めない）", () => {
    const saved = normalizeForSave(
      parsePageVisibilitySettings({ pages: { "/map": { roles: { anon: "public", vendor: "private" } } } }),
      false
    );
    expect(saved.pages["/map"].roles).toEqual({ vendor: "private" });
  });

  it("保存して読み戻しても本番の実効状態が変わらない", () => {
    const effective = applyEnvironmentDefaults(EMPTY_PAGE_VISIBILITY_SETTINGS, true);
    const roundTrip = applyEnvironmentDefaults(
      parsePageVisibilitySettings(normalizeForSave(effective, true)),
      true
    );
    expect(roundTrip).toEqual(effective);
  });
});
