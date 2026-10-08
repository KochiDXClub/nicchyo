import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const GA_ID = "G-TEST123";
const OPT_OUT_KEY = "nicchyo_analytics_opt_out";
const w = window as unknown as Record<string, unknown>;

// 旧キー移行の「済み」フラグがモジュール内にあるため、テストごとに読み直す
async function load() {
  vi.resetModules();
  return import("./consentClient");
}

beforeEach(() => {
  window.localStorage.clear();
  document.head.innerHTML = "";
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", GA_ID);
  delete w[`ga-disable-${GA_ID}`];
  delete w.gtag;
  delete w.dataLayer;
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("loadGA", () => {
  it("停止設定が無ければ gtag.js を読み込む", async () => {
    const { loadGA } = await load();
    loadGA();
    const script = document.getElementById("ga-script") as HTMLScriptElement | null;
    expect(script?.src).toContain(`id=${GA_ID}`);
  });

  it("停止中は gtag.js を読み込まず、ga-disable を立てる", async () => {
    window.localStorage.setItem(OPT_OUT_KEY, "1");
    const { loadGA } = await load();
    loadGA();
    expect(document.getElementById("ga-script")).toBeNull();
    expect(w[`ga-disable-${GA_ID}`]).toBe(true);
    expect(w.gtag).toBeUndefined();
  });

  it("測定IDが無ければ何もしない", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_ANALYTICS_ID", "");
    const { loadGA } = await load();
    loadGA();
    expect(document.getElementById("ga-script")).toBeNull();
  });

  it("2回呼んでも script は1つだけ", async () => {
    const { loadGA } = await load();
    loadGA();
    loadGA();
    expect(document.querySelectorAll("#ga-script")).toHaveLength(1);
  });
});

describe("setAnalyticsOptOut / isAnalyticsOptedOut", () => {
  it("停止を保存すると以後は停止扱いになり、ga-disable と変更イベントが出る", async () => {
    const { setAnalyticsOptOut, isAnalyticsOptedOut, ANALYTICS_OPT_OUT_CHANGE_EVENT } =
      await load();
    const listener = vi.fn();
    window.addEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, listener);
    expect(isAnalyticsOptedOut()).toBe(false);
    expect(setAnalyticsOptOut(true)).toBe(true);
    expect(isAnalyticsOptedOut()).toBe(true);
    expect(w[`ga-disable-${GA_ID}`]).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, listener);
  });

  it("再開すると停止が解除される", async () => {
    const { setAnalyticsOptOut, isAnalyticsOptedOut } = await load();
    setAnalyticsOptOut(true);
    expect(setAnalyticsOptOut(false)).toBe(true);
    expect(isAnalyticsOptedOut()).toBe(false);
    expect(w[`ga-disable-${GA_ID}`]).toBe(false);
  });

  it("書き込めない環境では false を返し、イベントも出さない", async () => {
    const { setAnalyticsOptOut, ANALYTICS_OPT_OUT_CHANGE_EVENT } = await load();
    const listener = vi.fn();
    window.addEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, listener);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(setAnalyticsOptOut(true)).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(ANALYTICS_OPT_OUT_CHANGE_EVENT, listener);
  });

  it("旧バナーで拒否していた人は停止として引き継がれ、旧キーは消える", async () => {
    window.localStorage.setItem("nicchyo_analytics_consent", "declined");
    window.localStorage.setItem("nicchyo_location_consent", "granted");
    const { isAnalyticsOptedOut } = await load();
    expect(isAnalyticsOptedOut()).toBe(true);
    expect(window.localStorage.getItem("nicchyo_analytics_consent")).toBeNull();
    expect(window.localStorage.getItem("nicchyo_location_consent")).toBeNull();
  });

  it("旧キーが granted なら停止にならない", async () => {
    window.localStorage.setItem("nicchyo_analytics_consent", "granted");
    const { isAnalyticsOptedOut } = await load();
    expect(isAnalyticsOptedOut()).toBe(false);
  });

  it("localStorage が読めない環境では停止していない扱い", async () => {
    const { isAnalyticsOptedOut } = await load();
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(isAnalyticsOptedOut()).toBe(false);
  });
});
