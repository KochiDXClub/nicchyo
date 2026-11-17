import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useMarketCalendar } from "./useMarketCalendar";

afterEach(() => vi.unstubAllGlobals());
it("API のエラーを空の成功結果と区別する", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
  const { result } = renderHook(() => useMarketCalendar());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe(true);
});
it("未登録でも取得成功ならエラーにしない", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ day: null, days: [], events: [] }) }));
  const { result } = renderHook(() => useMarketCalendar());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe(false);
});
