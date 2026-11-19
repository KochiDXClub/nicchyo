import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useShopChat } from "./useShopChat";

/** 返事が来ないまま待ち続ける fetch。中断されたら本物と同じく AbortError で落ちる */
function hangingFetch() {
  return vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted.", "AbortError"))
        );
      })
  );
}

describe("useShopChat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("答えが返ってこないまま30秒たったら打ち切り、失敗を伝える", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const { result } = renderHook(() => useShopChat(7));

    act(() => {
      void result.current.send("おすすめは？");
    });
    expect(result.current.streaming).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current.streaming).toBe(false);
    expect(result.current.messages.at(-1)).toEqual({
      role: "assistant",
      text: "うまく答えられませんでした。もう一度試してみてください。",
    });
  });

  it("利用者が止めたときは失敗の文言を出さない", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const { result } = renderHook(() => useShopChat(7));

    act(() => {
      void result.current.send("おすすめは？");
    });
    await act(async () => {
      result.current.abort();
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current.streaming).toBe(false);
    expect(result.current.messages.at(-1)).toEqual({ role: "assistant", text: "" });
  });
});
