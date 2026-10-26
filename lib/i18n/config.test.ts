import { describe, expect, test } from "vitest";
import { isLocalizablePath, localizePath, stripLocalePrefix, toLocale } from "./config";

describe("stripLocalePrefix", () => {
  test("/en を外してロケールを返す", () => {
    expect(stripLocalePrefix("/en/map")).toEqual({ locale: "en", pathname: "/map" });
    expect(stripLocalePrefix("/en")).toEqual({ locale: "en", pathname: "/" });
  });

  test("プレフィックスが無いパスはそのまま返す", () => {
    expect(stripLocalePrefix("/map")).toEqual({ locale: null, pathname: "/map" });
    expect(stripLocalePrefix("/")).toEqual({ locale: null, pathname: "/" });
  });

  test("/en で始まるだけの別パスは対象にしない", () => {
    expect(stripLocalePrefix("/english")).toEqual({ locale: null, pathname: "/english" });
    expect(stripLocalePrefix("/ja/map")).toEqual({ locale: null, pathname: "/ja/map" });
  });
});

describe("localizePath", () => {
  test("日本語は無印、英語は /en を付ける", () => {
    expect(localizePath("/map", "ja")).toBe("/map");
    expect(localizePath("/map", "en")).toBe("/en/map");
    expect(localizePath("/", "en")).toBe("/en");
  });

  test("すでに付いているロケールは付け替える", () => {
    expect(localizePath("/en/faq", "ja")).toBe("/faq");
    expect(localizePath("/en/faq", "en")).toBe("/en/faq");
  });
});

describe("toLocale", () => {
  test("不明な値は日本語になる", () => {
    expect(toLocale("en")).toBe("en");
    expect(toLocale("fr")).toBe("ja");
    expect(toLocale(undefined)).toBe("ja");
  });
});

describe("isLocalizablePath", () => {
  test("管理・API などは対象外", () => {
    expect(isLocalizablePath("/map")).toBe(true);
    expect(isLocalizablePath("/shops/001")).toBe(true);
    expect(isLocalizablePath("/admin/shops")).toBe(false);
    expect(isLocalizablePath("/api/shops")).toBe(false);
    expect(isLocalizablePath("/administrators")).toBe(true);
  });
});

describe("isLocalizablePath", () => {
  test("トークン付きの QR・招待リンクは /en へ飛ばさない", () => {
    expect(isLocalizablePath("/claim/abc")).toBe(false);
    expect(isLocalizablePath("/join/abc")).toBe(false);
    expect(isLocalizablePath("/faq")).toBe(true);
  });
});
