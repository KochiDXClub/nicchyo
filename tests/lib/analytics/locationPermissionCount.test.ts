import { beforeEach, describe, expect, it, vi } from "vitest";

const OPT_OUT_KEY = "nicchyo_analytics_opt_out";

function setPermissionState(state: PermissionState | null) {
  if (state === null) {
    Object.defineProperty(navigator, "permissions", { value: undefined, configurable: true });
    return;
  }
  Object.defineProperty(navigator, "permissions", {
    value: { query: vi.fn().mockResolvedValue({ state }) },
    configurable: true,
  });
}

/** 「答えが一度だけ数えられる」は読み込みごとなので、モジュールを読み直して毎回まっさらから始める */
async function loadReporter() {
  vi.resetModules();
  return import("../../../lib/analytics/locationPermissionCount");
}

describe("位置情報の許可・拒否の件数", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setPermissionState("prompt");
  });

  it("まだ聞かれていない画面で許可されたら、allowed を 1 回だけ送る", async () => {
    const { createLocationChoiceReporter } = await loadReporter();
    const reporter = createLocationChoiceReporter();
    await reporter.readPriorState();

    reporter.onAllowed();
    reporter.onAllowed();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/analytics/location-permission");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ choice: "allowed" });
  });

  it("送るのは choice だけ（位置や ID は含めない）", async () => {
    const { createLocationChoiceReporter } = await loadReporter();
    const reporter = createLocationChoiceReporter();
    await reporter.readPriorState();

    reporter.onDenied();

    const [, init] = fetchMock.mock.calls[0];
    expect(Object.keys(JSON.parse((init as RequestInit).body as string))).toEqual(["choice"]);
  });

  it("許可済みの再訪では数えない（答えを選んだ場面ではないため）", async () => {
    setPermissionState("granted");
    const { createLocationChoiceReporter } = await loadReporter();
    const reporter = createLocationChoiceReporter();
    await reporter.readPriorState();

    reporter.onAllowed();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Permissions API が無い端末では数えない（聞いた場面かどうか分からないため）", async () => {
    setPermissionState(null);
    const { createLocationChoiceReporter } = await loadReporter();
    const reporter = createLocationChoiceReporter();
    await reporter.readPriorState();

    reporter.onDenied();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("同じ読み込みの中では、地図と おでかけサポート の両方から聞いても 1 回だけ", async () => {
    const { createLocationChoiceReporter } = await loadReporter();
    const map = createLocationChoiceReporter();
    const guide = createLocationChoiceReporter();
    await map.readPriorState();
    await guide.readPriorState();

    map.onDenied();
    guide.onAllowed();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("アクセス解析を止めている端末では送らない", async () => {
    window.localStorage.setItem(OPT_OUT_KEY, "1");
    const { createLocationChoiceReporter } = await loadReporter();
    const reporter = createLocationChoiceReporter();
    await reporter.readPriorState();

    reporter.onAllowed();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("送信に失敗しても例外を投げない（地図を止めない）", async () => {
    fetchMock.mockRejectedValue(new TypeError("network down"));
    const { createLocationChoiceReporter } = await loadReporter();
    const reporter = createLocationChoiceReporter();
    await reporter.readPriorState();

    expect(() => reporter.onDenied()).not.toThrow();
    await Promise.resolve();
  });
});
