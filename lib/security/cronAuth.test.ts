import { describe, it, expect } from "vitest";
import { verifyBearerSecret } from "./cronAuth";

describe("verifyBearerSecret", () => {
  it("一致する Bearer トークンを許可する", () => {
    expect(verifyBearerSecret("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("不一致・長さ違いを拒否する", () => {
    expect(verifyBearerSecret("Bearer wrong!", "s3cret")).toBe(false);
    expect(verifyBearerSecret("Bearer s3cre", "s3cret")).toBe(false);
  });

  it("secret 未設定・ヘッダーなし・Bearer 形式でないものを拒否する", () => {
    expect(verifyBearerSecret("Bearer x", undefined)).toBe(false);
    expect(verifyBearerSecret("Bearer ", "")).toBe(false);
    expect(verifyBearerSecret(null, "s3cret")).toBe(false);
    expect(verifyBearerSecret("s3cret", "s3cret")).toBe(false);
    expect(verifyBearerSecret("Basic s3cret", "s3cret")).toBe(false);
  });
});
