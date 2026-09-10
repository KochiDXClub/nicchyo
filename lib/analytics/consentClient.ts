/**
 * アクセス解析の停止設定と、Google アナリティクスの読み込み
 *
 * 解析は既定で動く（オプトアウト方式）。何を外部へ送っているかは /privacy に記載し、
 * 同じページから停止できるようにしている。
 * 停止の設定はこの端末のブラウザにだけ保存される（端末や別ブラウザには引き継がれない）。
 */

const ANALYTICS_OPT_OUT_KEY = "nicchyo_analytics_opt_out";

/** 同意バナーがあった頃（オプトイン方式）のキー。意思を引き継ぐためだけに読む */
const LEGACY_ANALYTICS_CONSENT_KEY = "nicchyo_analytics_consent";
const LEGACY_LOCATION_CONSENT_KEY = "nicchyo_location_consent";

/** 停止設定が変わったことを同じ画面の中で知らせる */
export const ANALYTICS_OPT_OUT_CHANGE_EVENT = "nicchyo-analytics-opt-out-change";

/** プライベートモードなどで localStorage に触れないことがある */
function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** この画面で引き継ぎを済ませたか。旧キーは消すだけなので、一度やれば二度目は要らない */
let legacyConsentMigrated = false;

/**
 * バナーで「拒否する」を選んでいた人の意思を、新しい停止設定へ引き継ぐ。
 *
 * 引き継ぎが済んだら旧キーは消すので、以後は新キーだけを見ればよい。
 * 位置情報の旧キーはもう誰も読まないため、あわせて片付ける。
 */
function migrateLegacyConsent(storage: Storage): void {
  if (legacyConsentMigrated) return;
  legacyConsentMigrated = true;
  try {
    const legacy = storage.getItem(LEGACY_ANALYTICS_CONSENT_KEY);
    if (legacy !== null) {
      // 新しい設定を自分で決めたあとなら、そちらを優先する
      if (legacy === "declined" && storage.getItem(ANALYTICS_OPT_OUT_KEY) === null) {
        storage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
      }
      storage.removeItem(LEGACY_ANALYTICS_CONSENT_KEY);
    }
    storage.removeItem(LEGACY_LOCATION_CONSENT_KEY);
  } catch {
    // 書き込めない環境では引き継げないが、読み取りは続行させる
  }
}

/** アクセス解析を止めているか。読めない環境（サーバー側など）では止めていない扱い */
export function isAnalyticsOptedOut(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  migrateLegacyConsent(storage);
  try {
    return storage.getItem(ANALYTICS_OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setAnalyticsOptOut(optedOut: boolean): void {
  const storage = getStorage();
  if (!storage) return;
  // 旧キーを先に片付けないと、解析を再開したあとに引き継ぎが再び走ってしまう
  migrateLegacyConsent(storage);
  try {
    if (optedOut) storage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else storage.removeItem(ANALYTICS_OPT_OUT_KEY);
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
