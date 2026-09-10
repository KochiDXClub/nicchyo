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
  });

  it("何も設定していなければ止めていない扱いになる", async () => {
    const { isAnalyticsOptedOut } = await loadConsentClient();

    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("止める・再開するを保存できる", async () => {
    const { isAnalyticsOptedOut, setAnalyticsOptOut } = await loadConsentClient();

    setAnalyticsOptOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);

    setAnalyticsOptOut(false);
    expect(isAnalyticsOptedOut()).toBe(false);
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
