import { isAnalyticsOptedOut } from "@/lib/analytics/consentClient";

/**
 * お店の詳細が開かれたことを数える（出店者の「お店の分析」の元になる）。
 * 流入元は、地図から（map）・検索から（search）・それ以外（direct：QR や共有リンクなど）。
 */
export const SHOP_VIEW_SOURCES = ["map", "search", "direct"] as const;
export type ShopViewSource = (typeof SHOP_VIEW_SOURCES)[number];

/** 店舗ページ（/shops/001）へ来たときの流入元。前のページが検索なら search、それ以外は direct */
export function sourceFromReferrer(referrer: string, origin: string): ShopViewSource {
  try {
    const url = new URL(referrer);
    if (url.origin !== origin) return "direct";
    if (url.pathname.startsWith("/search")) return "search";
    if (url.pathname.startsWith("/map")) return "map";
  } catch {
    // 前のページが無い・読めないときは direct
  }
  return "direct";
}

const SESSION_KEY = "nicchyo:shop-views";

/** 同じタブで同じお店を開き直しても1回だけ送る（sessionStorage が使えなければ毎回送る） */
function markOnce(shopId: number): boolean {
  try {
    const seen = new Set<number>(JSON.parse(window.sessionStorage.getItem(SESSION_KEY) ?? "[]"));
    if (seen.has(shopId)) return false;
    seen.add(shopId);
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify([...seen]));
  } catch {
    // 保存できなくても数えるのは止めない
  }
  return true;
}

/** お店が開かれたことを記録する。結果は待たず、失敗は無視する */
export function recordShopView(shopId: number, source: ShopViewSource): void {
  if (typeof window === "undefined" || isAnalyticsOptedOut() || !markOnce(shopId)) return;
  void fetch("/api/analytics/shop-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId, source }),
    keepalive: true,
  }).catch(() => {});
}
