import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const optedOut = vi.fn();
vi.mock("@/lib/analytics/consentClient", () => ({ isAnalyticsOptedOut: () => optedOut() }));

import { recordFeatureUsage } from "./featureUsage";

describe("recordFeatureUsage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    optedOut.mockReturnValue(false);
    fetchMock.mockReset().mockResolvedValue(new Response(null));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("機能の名前だけを keepalive で送る", () => {
    recordFeatureUsage("map");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analytics/count");
    expect(init).toMatchObject({ method: "POST", keepalive: true });
    expect(JSON.parse(init.body)).toEqual({ kind: "usage", feature: "map" });
  });

  it("同じタブで同じ機能は 2 回目を送らない（別の機能は送る）", () => {
    recordFeatureUsage("consult");
    recordFeatureUsage("consult");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    recordFeatureUsage("search");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("解析を停止している人の分は送らず、印も付けない", () => {
    optedOut.mockReturnValue(true);
    recordFeatureUsage("shop");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("sessionStorage が例外を投げても送る", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    recordFeatureUsage("map");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("送信の失敗は外に出さない", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    expect(() => recordFeatureUsage("map")).not.toThrow();
    await Promise.resolve();
  });
});
