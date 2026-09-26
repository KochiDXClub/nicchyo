import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { validateLineSignature } from "./signature";

describe("validateLineSignature", () => {
  const channelSecret = "test-channel-secret-12345";
  const rawBody = JSON.stringify({
    destination: "U1234567890",
    events: [],
  });

  const validSignature = createHmac("sha256", channelSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  it("正しい署名の場合は true を返す", () => {
    const result = validateLineSignature(rawBody, channelSecret, validSignature);
    expect(result).toBe(true);
  });

  it("不正な署名の場合は false を返す", () => {
    const result = validateLineSignature(
      rawBody,
      channelSecret,
      "invalid-signature"
    );
    expect(result).toBe(false);
  });

  it("本文が改ざんされている場合は false を返す", () => {
    const tamperedBody = JSON.stringify({
      destination: "U9999999999",
      events: [],
    });
    const result = validateLineSignature(
      tamperedBody,
      channelSecret,
      validSignature
    );
    expect(result).toBe(false);
  });

  it("シークレットが異なる場合は false を返す", () => {
    const result = validateLineSignature(
      rawBody,
      "wrong-secret",
      validSignature
    );
    expect(result).toBe(false);
  });

  it("引数が欠落している場合は安全に false を返す", () => {
    expect(validateLineSignature("", channelSecret, validSignature)).toBe(false);
    expect(validateLineSignature(rawBody, "", validSignature)).toBe(false);
    expect(validateLineSignature(rawBody, channelSecret, null)).toBe(false);
    expect(validateLineSignature(rawBody, channelSecret, undefined)).toBe(false);
  });
});
