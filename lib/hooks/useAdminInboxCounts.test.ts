import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { notifyInboxChanged, useAdminInboxCounts } from "./useAdminInboxCounts";

const respond = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => respond({ notifications: 2, reports: 1, inquiries: 3 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("useAdminInboxCounts", () => {
  it("未読の通知・未対応の通報・未対応の問い合わせを取り、合計を返す", async () => {
    const { result } = renderHook(() => useAdminInboxCounts(true));
    await waitFor(() => expect(result.current.total).toBe(6));
    expect(result.current.counts).toEqual({ notifications: 2, reports: 1, inquiries: 3 });
    expect(fetch).toHaveBeenCalledWith("/api/admin/inbox-counts");
  });

  it("権限がないとき（enabled=false）は取りに行かない", async () => {
    const { result } = renderHook(() => useAdminInboxCounts(false));
    expect(result.current.total).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("取れなかったときは前の値のまま（バッジが消えない）", async () => {
    const { result } = renderHook(() => useAdminInboxCounts(true));
    await waitFor(() => expect(result.current.total).toBe(6));
    vi.mocked(fetch).mockResolvedValueOnce(respond({}, false));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.total).toBe(6);
  });

  it("対応したあと（notifyInboxChanged）は、すぐ取り直す", async () => {
    const { result } = renderHook(() => useAdminInboxCounts(true));
    await waitFor(() => expect(result.current.total).toBe(6));
    vi.mocked(fetch).mockResolvedValue(respond({ notifications: 0, reports: 0, inquiries: 3 }));
    act(() => notifyInboxChanged());
    await waitFor(() => expect(result.current.total).toBe(3));
  });
});
