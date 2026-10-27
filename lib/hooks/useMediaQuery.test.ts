import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LG_MEDIA_QUERY, useMediaQuery } from "./useMediaQuery";

type Listener = () => void;

function mockMatchMedia(initial: boolean) {
  let matches = initial;
  const listeners = new Set<Listener>();
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return matches;
    },
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
  return {
    set(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

describe("useMediaQuery", () => {
  afterEach(() => vi.restoreAllMocks());

  it("現在の画面幅が条件に合っているかを返す", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useMediaQuery(LG_MEDIA_QUERY));
    expect(result.current).toBe(true);
  });

  it("画面幅が変わったら追従する", () => {
    const media = mockMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(LG_MEDIA_QUERY));
    expect(result.current).toBe(false);

    act(() => media.set(true));
    expect(result.current).toBe(true);
  });

  it("matchMedia が無い環境では false を返し、壊れない", () => {
    // @ts-expect-error jsdom には無い環境を再現する
    delete window.matchMedia;
    const { result } = renderHook(() => useMediaQuery(LG_MEDIA_QUERY));
    expect(result.current).toBe(false);
  });

  it("使い終わったら購読を外す", () => {
    const media = mockMatchMedia(false);
    const { unmount } = renderHook(() => useMediaQuery(LG_MEDIA_QUERY));
    expect(media.listenerCount()).toBe(1);

    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
