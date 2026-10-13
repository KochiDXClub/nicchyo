import { describe, expect, it } from "vitest";
import { getForwardedClientIp } from "./clientIp";

function req(headers: Record<string, string>) {
  return new Request("http://localhost/api", { headers });
}

describe("getForwardedClientIp", () => {
  it("x-real-ip を優先する", () => {
    expect(
      getForwardedClientIp(req({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 8.8.8.8" })),
    ).toBe("1.2.3.4");
  });

  it("x-real-ip が無ければ x-forwarded-for の末尾（エッジが追記した値）を使う", () => {
    expect(getForwardedClientIp(req({ "x-forwarded-for": "6.6.6.6, 5.5.5.5" }))).toBe("5.5.5.5");
  });

  it("どちらも無い、または unknown なら null", () => {
    expect(getForwardedClientIp(req({}))).toBeNull();
    expect(getForwardedClientIp(req({ "x-real-ip": "unknown" }))).toBeNull();
    expect(getForwardedClientIp(req({ "x-forwarded-for": "  " }))).toBeNull();
  });
});
