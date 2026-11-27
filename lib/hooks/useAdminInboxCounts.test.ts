import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { notifyInboxChanged, useAdminInboxCounts } from "./useAdminInboxCounts";

const respond = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => respond({ notifications: 2, reports: 1, inquiries: 3, vendorInquiries: 4 })));
});
afterEach(() => vi.unstubAllGlobals());

describe("useAdminInboxCounts", () => {
  it("未読の通知・未対応の通報・未対応の問い合わせ・出店者からの連絡を取り、合計を返す", async () => {
    const { result } = renderHook(() => useAdminInboxCounts(true));
    await waitFor(() => expect(result.current.total).toBe(10));
    expect(result.current.counts).toEqual({ notifications: 2, reports: 1, inquiries: 3, vendorInquiries: 4 });
    expect(fetch).toHaveBeenCalledWith("/api/admin/inbox-counts");
  });

  it("権限がないとき（enabled=false）は取りに行かない", async () => {
    const { result } = renderHook(() => useAdminInboxCounts(false));
    expect(result.current.total).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("取れなかったときは前の値のまま（バッジが消えない）", async () => {
    const { result } = renderHook(() => useAdminInboxCounts(true));
    await waitFor(() => expect(result.current.total).toBe(10));
    vi.mocked(fetch).mockResolvedValueOnce(respond({}, false));
    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.total).toBe(10);
  });

  it("対応したあと（notifyInboxChanged）は、すぐ取り直す", async () => {
    const { result } = renderHook(() => useAdminInboxCounts(true));
    await waitFor(() => expect(result.current.total).toBe(10));
    vi.mocked(fetch).mockResolvedValue(respond({ notifications: 0, reports: 0, inquiries: 3, vendorInquiries: 0 }));
    act(() => notifyInboxChanged());
    await waitFor(() => expect(result.current.total).toBe(3));
  });
});

describe("useAdminInboxCounts を複数の場所で同時に使うとき", () => {
  it("サイドバーとタブが同じ画面で同時に使っても、取得は1回にまとめる", async () => {
    const { result } = renderHook(() => ({
      sidebar: useAdminInboxCounts(true, "/admin/notifications"),
      tabs: useAdminInboxCounts(true, "/admin/notifications"),
    }));
    await waitFor(() => expect(result.current.sidebar.total).toBe(10));
    process.stdout.write(`[measure] inbox-counts requests on mount with two users: ${vi.mocked(fetch).mock.calls.length}\n`);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("画面を移ったときも、同じ取得を共有する", async () => {
    const { result, rerender } = renderHook(
      ({ path }: { path: string }) => ({
        sidebar: useAdminInboxCounts(true, path),
        tabs: useAdminInboxCounts(true, path),
      }),
      { initialProps: { path: "/admin/notifications" } },
    );
    await waitFor(() => expect(result.current.sidebar.total).toBe(10));
    rerender({ path: "/admin/reports" });
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });

  it("対応したあと（notifyInboxChanged）は、両方とも新しい件数になる", async () => {
    const { result } = renderHook(() => ({
      sidebar: useAdminInboxCounts(true),
      tabs: useAdminInboxCounts(true),
    }));
    await waitFor(() => expect(result.current.sidebar.total).toBe(10));
    vi.mocked(fetch).mockResolvedValue(respond({ notifications: 0, reports: 0, inquiries: 3, vendorInquiries: 0 }));
    act(() => notifyInboxChanged());
    await waitFor(() => {
      expect(result.current.sidebar.total).toBe(3);
      expect(result.current.tabs.total).toBe(3);
    });
  });
});
