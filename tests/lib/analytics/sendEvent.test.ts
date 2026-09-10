/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

// GA の読み込みは差し替える。停止設定はテストごとに切り替えられるようにする
const consent = vi.hoisted(() => ({ optedOut: false }));

vi.mock("../../../lib/analytics/consentClient", () => {
  return {
    loadGA: vi.fn(),
    isAnalyticsOptedOut: () => consent.optedOut,
  } as any;
});

describe("sendEvent wrapper", () => {
  let sendEvent: (...args: any[]) => void;

  beforeEach(async () => {
    consent.optedOut = false;
    // reset globals
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true })) as any;
    (globalThis as any).window = globalThis as any;
    (globalThis as any).dataLayer = [];
    (globalThis as any).gtag = vi.fn();
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "nicchyo_visitor_id=visitor123",
    });

    ({ sendEvent } = await import("../../../lib/analytics/sendEvent"));
  });

  afterEach(() => {
    vi.resetAllMocks();
    try {
      delete (globalThis as any).gtag;
      delete (globalThis as any).dataLayer;
    } catch {}
  });

  it("sends dataLayer/gtag and posts to server when toServer=true", async () => {
    sendEvent("shop_impression" as any, { shop_id: "shop1", list_position: 2, context: "list" }, { toServer: true });

    // dataLayer push
    expect((globalThis as any).dataLayer.length).toBeGreaterThan(0);
    const pushed = (globalThis as any).dataLayer[(globalThis as any).dataLayer.length - 1];
    expect(pushed.event).toBe("shop_impression");
    expect(pushed.shop_id).toBe("shop1");

    // gtag called
    expect((globalThis as any).gtag).toHaveBeenCalled();

    // fetch called to server API
    expect(globalThis.fetch).toHaveBeenCalled();
    const fetchCall = (globalThis.fetch as any).mock.calls[0];
    expect(fetchCall[0]).toContain("/api/analytics/shop-interaction");
  });

  it("toServer を指定しなければサーバーへは送らない", async () => {
    sendEvent("shop_impression" as any, { shop_id: "shop2" });

    expect((globalThis as any).dataLayer.length).toBeGreaterThan(0);
    expect((globalThis as any).fetch).not.toHaveBeenCalled();
  });

  it("解析を止めている端末では、どこへも送らない", async () => {
    consent.optedOut = true;

    sendEvent("shop_impression" as any, { shop_id: "shop3" }, { toServer: true });

    expect((globalThis as any).dataLayer.length).toBe(0);
    expect((globalThis as any).gtag).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
