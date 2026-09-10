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
 * 失敗したときの再試行の残り回数
 *
 * 途中で失敗したまま済みにすると意思が巻き戻るのでやり直す。
 * ただし isAnalyticsOptedOut() は送信のたびに呼ばれるため、
 * 常に失敗する環境で延々と試し続けないよう上限を設ける。
 */
let legacyConsentRetriesLeft = 3;

/**
 * バナーで「拒否する」を選んでいた人の意思を、新しい停止設定へ引き継ぐ。
 *
 * 引き継ぎが済んだら旧キーは消すので、以後は新キーだけを見ればよい。
 * 位置情報の旧キーはもう誰も読まないため、あわせて片付ける。
 */
function migrateLegacyConsent(storage: Storage): void {
  if (legacyConsentMigrated) return;
  if (legacyConsentRetriesLeft <= 0) return;
  legacyConsentRetriesLeft -= 1;
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
    // 最後まで通ったときだけ済みとする。途中で失敗したら次の機会にやり直す
    // （旧キーが残ったままだと、再開したあとに引き継ぎが巻き戻してしまう）
    legacyConsentMigrated = true;
  } catch {
    // 書き込めない環境では引き継げないが、読み取りは続行させる
  }
}

/** 保存されている停止設定。null は「読めなかった」ことを表す */
function readStoredOptOut(storage: Storage): boolean | null {
  try {
    return storage.getItem(ANALYTICS_OPT_OUT_KEY) === "1";
  } catch {
    return null;
  }
}

/** 測定IDの出どころはここ1か所にする（読み込む先と止める先がずれないように） */
function getGaId(): string | undefined {
  return process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
}

/**
 * 読み込み済みの Google アナリティクスを止める／再開する
 *
 * gtag.js は拡張計測（履歴の変化による page_view、スクロールなど）を
 * 自分の判断で送るため、こちらの送信口を塞ぐだけでは止まらない。
 * `ga-disable-<測定ID>` は GA 公式のオプトアウト手段で、
 * すでに読み込まれている gtag.js にもその場で効く。
 */
export function applyGaOptOut(optedOut: boolean): void {
  if (typeof window === "undefined") return;
  const gaId = getGaId();
  if (!gaId) return;
  (window as unknown as Record<string, boolean>)[`ga-disable-${gaId}`] = optedOut;
}

/** アクセス解析を止めているか。読めない環境（サーバー側など）では止めていない扱い */
export function isAnalyticsOptedOut(): boolean {
  const storage = getStorage();
  if (!storage) return false;
  migrateLegacyConsent(storage);
  return readStoredOptOut(storage) === true;
}

/**
 * 停止設定を保存する。保存できたかどうかを返す。
 *
 * プライベートモードや容量超過で書き込めないことがある。黙って失敗すると
 * 「止めたつもりなのに次の来訪では動いている」ことになるので、
 * 呼ぶ側が気づけるように結果を返す。
 */
export function setAnalyticsOptOut(optedOut: boolean): boolean {
  const storage = getStorage();
  if (!storage) return false;
  // 旧キーを先に片付けないと、解析を再開したあとに引き継ぎが再び走ってしまう
  migrateLegacyConsent(storage);
  try {
    if (optedOut) storage.setItem(ANALYTICS_OPT_OUT_KEY, "1");
    else storage.removeItem(ANALYTICS_OPT_OUT_KEY);
    // 書けたつもりで実は残っていないことがあるため、読み直して確かめる
    // （読めなかった null のときも、確かめられていないので失敗として扱う）
    if (readStoredOptOut(storage) !== optedOut) return false;
  } catch {
    return false;
  }
  // 読み込み済みの GA をその場で止める／再開する
  applyGaOptOut(optedOut);
  window.dispatchEvent(new Event(ANALYTICS_OPT_OUT_CHANGE_EVENT));
  return true;
}

export function loadGA(): void {
  if (typeof window === "undefined") return;
  const gaId = getGaId();
  if (!gaId) return;
  const optedOut = isAnalyticsOptedOut();
  // 読み込むかどうかに関わらず、まず gtag.js への指示を揃えておく
  applyGaOptOut(optedOut);
  if (optedOut) return;
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
