import { describe, expect, it } from "vitest";
import { isSecretTokenPath, toTrackedPath } from "./secretPaths";

describe("toTrackedPath", () => {
  it("自由入力の ?q= を外す（検索語を解析・GA に残さない）", () => {
    expect(toTrackedPath("/map?q=%E5%B1%B1%E7%94%B0")).toBe("/map");
    expect(toTrackedPath("/consult?q=hello&shopId=12")).toBe("/consult?shopId=12");
    expect(toTrackedPath("/map?guide=menu&q=090-1234-5678")).toBe("/map?guide=menu");
  });
  it("?q= が無ければそのまま返す（ほかのパラメータの書き方も変えない）", () => {
    expect(toTrackedPath("/map")).toBe("/map");
    expect(toTrackedPath("/map?guide=menu&label=a%20b")).toBe("/map?guide=menu&label=a%20b");
    expect(toTrackedPath("/shops/001?qr=1")).toBe("/shops/001?qr=1");
  });
});

describe("isSecretTokenPath", () => {
  it("QR と招待リンクのパスを秘密として扱う", () => {
    expect(isSecretTokenPath("/claim/abc")).toBe(true);
    expect(isSecretTokenPath("/join/abc?x=1")).toBe(true);
    expect(isSecretTokenPath("/claim")).toBe(true);
  });
  it("ロケールが付いていても秘密のパスとして扱う", () => {
    expect(isSecretTokenPath("/en/claim/abc")).toBe(true);
    expect(isSecretTokenPath("/en/join/abc")).toBe(true);
  });
  it("似た名前の別ページは対象にしない", () => {
    expect(isSecretTokenPath("/claimed")).toBe(false);
    expect(isSecretTokenPath("/shops/001")).toBe(false);
    expect(isSecretTokenPath("/")).toBe(false);
  });
});
