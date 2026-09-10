import { beforeEach, describe, expect, it } from "vitest";

import {
  isAnalyticsOptedOut,
  setAnalyticsOptOut,
} from "../../../lib/analytics/consentClient";

const OPT_OUT_KEY = "nicchyo_analytics_opt_out";
const LEGACY_ANALYTICS_KEY = "nicchyo_analytics_consent";
const LEGACY_LOCATION_KEY = "nicchyo_location_consent";

describe("アクセス解析の停止設定", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("何も設定していなければ止めていない扱いになる", () => {
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("止める・再開するを保存できる", () => {
    setAnalyticsOptOut(true);
    expect(isAnalyticsOptedOut()).toBe(true);

    setAnalyticsOptOut(false);
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  describe("同意バナー時代の設定の引き継ぎ", () => {
    it("バナーで「拒否する」を選んでいた人は、止めたままになる", () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "declined");

      expect(isAnalyticsOptedOut()).toBe(true);
      expect(window.localStorage.getItem(OPT_OUT_KEY)).toBe("1");
      // 引き継ぎ済みの旧キーは残さない
      expect(window.localStorage.getItem(LEGACY_ANALYTICS_KEY)).toBeNull();
    });

    it("バナーで「すべて許可」を選んでいた人は、そのまま動く", () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "accepted");

      expect(isAnalyticsOptedOut()).toBe(false);
      expect(window.localStorage.getItem(OPT_OUT_KEY)).toBeNull();
      expect(window.localStorage.getItem(LEGACY_ANALYTICS_KEY)).toBeNull();
    });

    it("引き継いだあとに自分で再開したら、次に読んでも止まらない", () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "declined");
      expect(isAnalyticsOptedOut()).toBe(true);

      setAnalyticsOptOut(false);
      expect(isAnalyticsOptedOut()).toBe(false);
    });

    it("読む前に自分で再開しても、旧キーに引き戻されない", () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "declined");

      setAnalyticsOptOut(false);
      expect(isAnalyticsOptedOut()).toBe(false);
    });

    it("自分で決めた停止設定は、旧キーに上書きされない", () => {
      window.localStorage.setItem(LEGACY_ANALYTICS_KEY, "accepted");
      window.localStorage.setItem(OPT_OUT_KEY, "1");

      expect(isAnalyticsOptedOut()).toBe(true);
    });

    it("使われなくなった位置情報の同意キーは片付ける", () => {
      window.localStorage.setItem(LEGACY_LOCATION_KEY, "accepted");

      isAnalyticsOptedOut();

      expect(window.localStorage.getItem(LEGACY_LOCATION_KEY)).toBeNull();
    });
  });
});
