/**
 * アクセス解析の停止設定と、Google アナリティクスの読み込み
 *
 * 解析は既定で動く（オプトアウト方式）。何を外部へ送っているかは /privacy に記載し、
 * 同じページから停止できるようにしている。
 * 停止の設定はこの端末のブラウザにだけ保存される（端末や別ブラウザには引き継がれない）。
 */

const ANALYTICS_OPT_OUT_KEY = "nicchyo_analytics_opt_out";

/** 停止設定が変わったことを同じ画面の中で知らせる */
export const ANALYTICS_OPT_OUT_CHANGE_EVENT = "nicchyo-analytics-opt-out-change";

/** アクセス解析を止めているか。読めない環境（サーバー側など）では止めていない扱い */
export function isAnalyticsOptedOut(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === "1";
  } catch {
    // プライベートモードなどで localStorage が読めないことがある
    return false;
  }
}

export function setAnalyticsOptOut(optedOut: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (optedOut) window.localStorage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else window.localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
  } catch {
    return;
  }
  window.dispatchEvent(new Event(ANALYTICS_OPT_OUT_CHANGE_EVENT));
}

export function loadGA(gaId: string): void {
  if (typeof window === "undefined") return;
  if (isAnalyticsOptedOut()) return;
  if (document.getElementById("ga-script")) return;

  const script = document.createElement("script");
  script.id = "ga-script";
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  script.async = true;
  document.head.appendChild(script);

  interface GtagWindow {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
  const w = window as Window & GtagWindow;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function (...args: unknown[]) {
    w.dataLayer!.push(args);
  };
  w.gtag("js", new Date());
  w.gtag("config", gaId);
}
