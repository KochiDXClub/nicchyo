import { beforeEach, describe, expect, it, vi } from "vitest";

const OPT_OUT_KEY = "nicchyo_analytics_opt_out";
const LEGACY_ANALYTICS_KEY = "nicchyo_analytics_consent";
const LEGACY_LOCATION_KEY = "nicchyo_location_consent";

/**
 * 引き継ぎは画面ごとに一度きりなので、モジュールを読み直して毎回まっさらから始める。
 * （実際の利用でも、読み込み直した画面＝新しい来訪という単位になる）
 */
async function loadConsentClient() {
  vi.resetModules();
  return import("../../../lib/analytics/consentClient");
}

describe("アクセス解析の停止設定", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    delete (window as unknown as Record<string, unknown>)["ga-disable-G-TEST"];
  });

  describe("読み込み済みの Google アナリティクスの停止", () => {
    const flag = () => (window as unknown as Record<string, unknown>)["ga-disable-G-TEST"];

    it("止めると ga-disable が立ち、再開すると下りる", async () => {
      vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", "G-TEST");
      const { setAnalyticsOptOut } = await loadConsentClient();

      setAnalyticsOptOut(true);
      expect(flag()).toBe(true);

      setAnalyticsOptOut(false);
      expect(flag()).toBe(false);
    });

    it("保存できなかったときは ga-disable も動かさない", async () => {
      vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", "G-TEST");
      const { setAnalyticsOptOut } = await loadConsentClient();
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);

      expect(setAnalyticsOptOut(true)).toBe(false);
      expect(flag()).toBeUndefined();

      setItem.mockRestore();
    });

    it("止めている端末では GA を読み込まず、止める指示だけ出す", async () => {
      vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", "G-TEST");
      window.localStorage.setItem(OPT_OUT_KEY, "1");
      const { loadGA } = await loadConsentClient();

      loadGA();

      expect(document.getElementById("ga-script")).toBeNull();
      expect(flag()).toBe(true);
    });
  });

  it("何も設定していなければ止めていない扱いになる", async () => {
    const { isAnalyticsOptedOut } = await loadConsentClient();

    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("止める・再開するを保存でき、保存できたことを返す", async () => {
    const { isAnalyticsOptedOut, setAnalyticsOptOut } = await loadConsentClient();

    expect(setAnalyticsOptOut(true)).toBe(true);
    expect(isAnalyticsOptedOut()).toBe(true);

    expect(setAnalyticsOptOut(false)).toBe(true);
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  describe("保存できなかったとき", () => {
    it("書き込みが例外になったら false を返す", async () => {
      const { setAnalyticsOptOut } = await loadConsentClient();
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("QuotaExceededError");
      });

      expect(setAnalyticsOptOut(true)).toBe(false);

      setItem.mockRestore();
    });

    it("例外は出ないが実際には残らなかったときも false を返す", async () => {
      const { setAnalyticsOptOut } = await loadConsentClient();
      // 書けたように見えて保存されないブラウザを模す
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);

      expect(setAnalyticsOptOut(true)).toBe(false);

      setItem.mockRestore();
    });

    it("読み直しができなかったときも false を返す", async () => {
      const { setAnalyticsOptOut } = await loadConsentClient();
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);
      const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("SecurityError");
      });

      // 再開（false）でも「確かめられていない」ので成功と言わない
      expect(setAnalyticsOptOut(false)).toBe(false);

      getItem.mockRestore();
      setItem.mockRestore();
    });

    it("旧キーを消せなかったら、済みにせず次の機会にやり直す", async () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "declined");
      const { isAnalyticsOptedOut } = await loadConsentClient();
      const removeItem = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new DOMException("SecurityError");
      });

      expect(isAnalyticsOptedOut()).toBe(true);
      removeItem.mockRestore();

      // やり直せていれば、ここで旧キーが片付く
      isAnalyticsOptedOut();
      expect(window.localStorage.getItem(LEGACY_ANALYTICS_KEY)).toBeNull();
    });

    it("保存できなかったときは切り替わったことを知らせない", async () => {
      const { setAnalyticsOptOut, ANALYTICS_OPT_OUT_CHANGE_EVENT } = await loadConsentClient();
      const listener = vi.fn();
      window.addEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, listener);
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => undefined);

      setAnalyticsOptOut(true);

      expect(listener).not.toHaveBeenCalled();

      setItem.mockRestore();
      window.removeEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, listener);
    });
  });

  describe("同意バナー時代の設定の引き継ぎ", () => {
    it("バナーで「拒否する」を選んでいた人は、止めたままになる", async () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "declined");
      const { isAnalyticsOptedOut } = await loadConsentClient();

      expect(isAnalyticsOptedOut()).toBe(true);
      expect(window.localStorage.getItem(OPT_OUT_KEY)).toBe("1");
      // 引き継ぎ済みの旧キーは残さない
      expect(window.localStorage.getItem(LEGACY_ANALYTICS_KEY)).toBeNull();
    });

    it("バナーで「すべて許可」を選んでいた人は、そのまま動く", async () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "accepted");
      const { isAnalyticsOptedOut } = await loadConsentClient();

      expect(isAnalyticsOptedOut()).toBe(false);
      expect(window.localStorage.getItem(OPT_OUT_KEY)).toBeNull();
      expect(window.localStorage.getItem(LEGACY_ANALYTICS_KEY)).toBeNull();
    });

    it("引き継いだあとに自分で再開したら、次に読んでも止まらない", async () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "declined");
      const { isAnalyticsOptedOut, setAnalyticsOptOut } = await loadConsentClient();
      expect(isAnalyticsOptedOut()).toBe(true);

      setAnalyticsOptOut(false);
      expect(isAnalyticsOptedOut()).toBe(false);
    });

    it("読む前に自分で再開しても、旧キーに引き戻されない", async () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "declined");
      const { isAnalyticsOptedOut, setAnalyticsOptOut } = await loadConsentClient();

      setAnalyticsOptOut(false);
      expect(isAnalyticsOptedOut()).toBe(false);
    });

    it("自分で決めた停止設定は、旧キーに上書きされない", async () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "accepted");
      window.localStorage.setItem(OPT_OUT_KEY, "1");
      const { isAnalyticsOptedOut } = await loadConsentClient();

      expect(isAnalyticsOptedOut()).toBe(true);
    });

    it("使われなくなった位置情報の同意キーは片付ける", async () => {
      window.localStorage.setItem(LEGACY_LOCATION_KEY, "accepted");
      const { isAnalyticsOptedOut } = await loadConsentClient();

      isAnalyticsOptedOut();

      expect(window.localStorage.getItem(LEGACY_LOCATION_KEY)).toBeNull();
    });

    it("一度引き継いだら、以後は旧キーを読み書きしない", async () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "declined");
      const { isAnalyticsOptedOut } = await loadConsentClient();
      expect(isAnalyticsOptedOut()).toBe(true);

      const removeItem = vi.spyOn(Storage.prototype, "removeItem");
      const setItem = vi.spyOn(Storage.prototype, "setItem");

      isAnalyticsOptedOut();
      isAnalyticsOptedOut();

      expect(removeItem).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();

      removeItem.mockRestore();
      setItem.mockRestore();
    });
  });
});
