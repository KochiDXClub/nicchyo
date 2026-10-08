import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocationPermissionGate } from "./useLocationPermissionGate";

// ローディングの状態はテストごとに差し替える
const loading = vi.hoisted(() => ({ status: "idle" as "idle" | "loading" | "leaving" }));

vi.mock("@/app/components/MapLoadingProvider", () => ({
  useMapLoading: () => loading,
}));

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

describe("useLocationPermissionGate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    loading.status = "idle";
    setPermissionState("prompt");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("ローディング中は開かない", async () => {
    loading.status = "loading";
    const { result } = renderHook(() => useLocationPermissionGate());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });

    expect(result.current).toBe(false);
  });

  it("畳まれてから待ち時間ぶん経つと開く", async () => {
    const { result } = renderHook(() => useLocationPermissionGate(false, 3000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2999);
    });
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current).toBe(true);
  });

  it("すでに許可されているときは待たずに開く", async () => {
    setPermissionState("granted");
    const { result } = renderHook(() => useLocationPermissionGate(false, 3000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current).toBe(true);
  });

  it("Permissions API が無いブラウザでは待ってから開く（取得不能にはしない）", async () => {
    setPermissionState(null);
    const { result } = renderHook(() => useLocationPermissionGate(false, 3000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current).toBe(true);
  });

  it("geolocation を照会できないブラウザでも待ってから開く", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockRejectedValue(new TypeError("unsupported")) },
      configurable: true,
    });
    const { result } = renderHook(() => useLocationPermissionGate(false, 3000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(result.current).toBe(true);
  });

  it("ご自分から求められたときは、ローディング中でもすぐ開く", async () => {
    loading.status = "loading";
    const { result, rerender } = renderHook(
      ({ requested }) => useLocationPermissionGate(requested),
      { initialProps: { requested: false } }
    );

    // ローディング中なので、こちらから勝手に聞くぶんは待たされる
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(result.current).toBe(false);

    // 現在地ボタンを押した相当。待ち時間を挟まずその場で開く
    act(() => {
      rerender({ requested: true });
    });
    expect(result.current).toBe(true);
  });

  it("一度開いたら、ローディングが始まっても閉じない", async () => {
    const { result, rerender } = renderHook(() => useLocationPermissionGate(false, 3000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(result.current).toBe(true);

    // 画面遷移などで再びローディングに戻っても、取得を止めてはいけない
    loading.status = "loading";
    rerender();
    expect(result.current).toBe(true);

    loading.status = "leaving";
    rerender();
    expect(result.current).toBe(true);
  });
});
