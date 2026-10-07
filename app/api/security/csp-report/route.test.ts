import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/security/rateLimit", () => ({ enforceRateLimit: async () => null }));

import { POST } from "./route";

function post(body: string, headers: Record<string, string> = {}) {
  return POST(
    new Request("https://nicchyo.example/api/security/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report", ...headers },
      body,
    }) as never,
  );
}

describe("POST /api/security/csp-report", () => {
  it("レポートは console.warn に出すだけで 200 を返す", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(JSON.stringify({ "csp-report": { "blocked-uri": "https://x.example" } }));
    expect(res.status).toBe(200);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("大きすぎるボディは読まずに捨てる", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const big = "x".repeat(20 * 1024);
    const res = await post(big, { "content-length": String(big.length) });
    expect(res.status).toBe(200);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("壊れたボディでも 200", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await post("")).status).toBe(200);
    warn.mockRestore();
  });
});
