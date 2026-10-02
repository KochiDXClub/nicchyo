/**
 * 画面の中の小さな「?」（FeatureHelpButton）から、説明パネル（VendorTourHost）を開く合図。
 * ボタンはページの奥に、ホストはレイアウトにあって親子ではないので、window のイベントでつなぐ。
 */
const OPEN_EVENT = "vendor-tour:open";

/** この機能（lib/vendor/tours.ts の key）の説明を開いてほしい、と伝える */
export function requestOpenVendorTour(key: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { key } }));
}

/** 開いてほしい、という合図を受け取る。戻り値で受け取りをやめる */
export function onOpenVendorTour(handler: (key: string) => void): () => void {
  const listener = (event: Event) => {
    const key = (event as CustomEvent<{ key?: unknown }>).detail?.key;
    if (typeof key === "string") handler(key);
  };
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
