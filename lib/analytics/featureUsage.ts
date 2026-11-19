import { isAnalyticsOptedOut } from "@/lib/analytics/consentClient";
import type { UsageFeature } from "@/lib/analytics/countEvents";

const SESSION_KEY_PREFIX = "nicchyo:feature-used:";

/** 同じタブで同じ機能を何度使っても1回だけ送る（sessionStorage が使えなければ毎回送る） */
function markOnce(feature: UsageFeature): boolean {
  try {
    const key = `${SESSION_KEY_PREFIX}${feature}`;
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, "1");
  } catch {
    // 保存できなくても数えるのは止めない
  }
  return true;
}

/**
 * 機能（地図・AI相談・検索・お店の詳細）が使われたことを、1 回の訪問につき 1 回だけ数える（#1069）。
 * 送るのは機能の名前だけで、端末を見分ける ID は送らない。結果は待たず、失敗は無視する。
 */
export function recordFeatureUsage(feature: UsageFeature): void {
  if (typeof window === "undefined" || isAnalyticsOptedOut() || !markOnce(feature)) return;
  void fetch("/api/analytics/count", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "usage", feature }),
    keepalive: true,
  }).catch(() => {});
}
