import { describe, expect, it } from "vitest";
import { isSecretTokenPath } from "./secretPaths";

describe("isSecretTokenPath", () => {
  it("QR と招待リンクのパスを秘密として扱う", () => {
    expect(isSecretTokenPath("/claim/abc")).toBe(true);
    expect(isSecretTokenPath("/join/abc?x=1")).toBe(true);
    expect(isSecretTokenPath("/claim")).toBe(true);
  });
  it("似た名前の別ページは対象にしない", () => {
    expect(isSecretTokenPath("/claimed")).toBe(false);
    expect(isSecretTokenPath("/shops/001")).toBe(false);
    expect(isSecretTokenPath("/")).toBe(false);
  });
});
