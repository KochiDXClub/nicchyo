"use client";

import { isAnalyticsAllowed, loadGA } from "@/lib/analytics/consentClient";
import type {
  AnalyticsEventName,
  AnalyticsParams,
  GuideEventParams,
  SendEventOptions,
  ShopImpressionParams,
} from "@/types/analytics";

const GUIDE_EVENT_TYPES: Partial<Record<AnalyticsEventName, string>> = {
  guide_open: "open",
  guide_navigation_start: "navigation_start",
  guide_arrived: "arrived",
  guide_navigation_stop: "navigation_stop",
};

function getVisitorKey(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )nicchyo_visitor_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function safeJson(v: unknown) {
  try {
    return JSON.parse(JSON.stringify(v));
  } catch {
    return null;
  }
}

async function postJson(url: string, body: unknown) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // silent
  }
}

export function sendEvent(name: AnalyticsEventName, params: AnalyticsParams = {}, options: SendEventOptions = {}) {
  if (!isAnalyticsAllowed()) return;

  // Ensure GA loader present in production if not yet loaded
  interface GtagWindow {
    __nicchyo_ga_loaded?: boolean;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
  try {
    if (typeof window !== "undefined" && !(window as Window & GtagWindow).__nicchyo_ga_loaded) {
      const gaId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
      if (gaId && process.env.NODE_ENV === "production") loadGA(gaId);
    }
  } catch {}

  const payload = safeJson(params) ?? {};

  // dataLayer push for GTM compatibility
  try {
    const w = window as Window & GtagWindow;
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: name, ...payload });
  } catch {}

  // gtag for GA4
  try {
    const w = window as Window & GtagWindow;
    if (typeof w?.gtag === "function") {
      w.gtag("event", name, payload);
    }
  } catch {}

  // server-side reliable logging for specific events
  if (options.toServer) {
    const visitor_key = getVisitorKey();
    if (name === "shop_impression") {
      const p = params as ShopImpressionParams;
      postJson("/api/analytics/shop-interaction", {
        visitor_key,
        shop_id: p.shop_id,
        event_type: "impression",
        meta: { list_position: p.list_position ?? null, context: p.context ?? null },
      });
    }

    if (name === "shop_view") {
      const p = params as Record<string, unknown>;
      postJson("/api/analytics/shop-interaction", {
        visitor_key,
        shop_id: p.shop_id,
        event_type: "view",
        meta: { source: p.source ?? null, interaction_method: p.interaction_method ?? null },
      });
    }

    const guideEventType = GUIDE_EVENT_TYPES[name];
    if (guideEventType) {
      const p = params as GuideEventParams;
      postJson("/api/analytics/guide-event", {
        visitor_key,
        event_type: guideEventType,
        kinds: p.kinds ?? [],
        spot_key: p.spot_key ?? null,
        origin_type: p.origin_type ?? null,
        walk_minutes: p.walk_minutes ?? null,
        distance_meters: p.distance_meters ?? null,
      });
    }
  }
}

// Helper: track scroll depth on an element and send thresholds 25/50/75/100
export function trackScrollDepth(element: HTMLElement, shopId: string | null = null) {
  if (!element || typeof window === "undefined") return () => {};
  const thresholds = [25, 50, 75, 100];
  const sent = new Set<number>();

  function check() {
    const rect = element.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const depth = Math.min(100, Math.max(0, Math.round(((vh - rect.top) / vh) * 100)));
    thresholds.forEach((t) => {
      if (depth >= t && !sent.has(t)) {
        sent.add(t);
        sendEvent("shop_scroll", { shop_id: shopId ?? "", scroll_area: "shop_detail", scroll_depth: t }, { toServer: true });
      }
    });
  }

  let throttleTimer: ReturnType<typeof setTimeout> | null = null;
  const throttled = () => {
    if (throttleTimer) return;
    throttleTimer = setTimeout(() => {
      throttleTimer = null;
      check();
    }, 300);
  };

  element.addEventListener("scroll", throttled, { passive: true });
  window.addEventListener("resize", throttled);

  // initial check
  setTimeout(check, 200);

  return () => {
    element.removeEventListener("scroll", throttled);
    window.removeEventListener("resize", throttled);
  };
}
