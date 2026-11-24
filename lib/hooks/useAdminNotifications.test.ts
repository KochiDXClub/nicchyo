import { renderHook, act, waitFor } from "@testing-library/react";
import { useAdminNotifications } from "./useAdminNotifications";
import { expect, test, describe, vi, beforeEach, afterEach } from "vitest";

describe("useAdminNotifications", () => {
  const mockNotifications = [
    {
      id: "1",
      type: "alert",
      title: "Test 1",
      body: null,
      link: null,
      is_read: false,
      created_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      type: "info",
      title: "Test 2",
      body: null,
      link: null,
      is_read: true,
      created_at: "2024-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  test("returns default state when disabled", () => {
    const { result } = renderHook(() => useAdminNotifications(false));

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("fetches notifications when enabled", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ notifications: mockNotifications }),
    } as Response);

    const { result } = renderHook(() => useAdminNotifications(true));

    await waitFor(() => {
      expect(result.current.notifications).toEqual(mockNotifications);
      expect(result.current.unreadCount).toBe(1);
    }, { timeout: 1000 });

    expect(global.fetch).toHaveBeenCalledWith("/api/admin/notifications");
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test("handles fetch failure gracefully", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
    } as Response);

    const { result } = renderHook(() => useAdminNotifications(true));

    // Wait for the effect to finish, fetch is called once immediately
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1), { timeout: 1000 });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  test("handles fetch throwing gracefully", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network Error"));

    const { result } = renderHook(() => useAdminNotifications(true));

    // Wait for the effect to finish, fetch is called once immediately
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1), { timeout: 1000 });

    expect(result.current.notifications).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });


  test("polls every 60 seconds", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: mockNotifications }),
    } as Response);

    renderHook(() => useAdminNotifications(true));

    // Wait for the initial fetch to complete
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1), { timeout: 1000 });

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  test("markAllRead sends PATCH and updates state", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ notifications: mockNotifications }),
      } as Response) // initial fetch
      .mockResolvedValueOnce({
        ok: true,
      } as Response); // PATCH

    const { result } = renderHook(() => useAdminNotifications(true));

    await waitFor(() => {
      expect(result.current.notifications).toEqual(mockNotifications);
      expect(result.current.unreadCount).toBe(1);
    }, { timeout: 1000 });

    await act(async () => {
      await result.current.markAllRead();
    });

    expect(global.fetch).toHaveBeenCalledWith("/api/admin/notifications", { method: "PATCH" });

    expect(result.current.unreadCount).toBe(0);
    expect(result.current.notifications.every(n => n.is_read)).toBe(true);
  });

  test("タブが見えていない間は定期取得をせず、戻ったときに1回取り直す", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: mockNotifications }),
    } as Response);
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    renderHook(() => useAdminNotifications(true));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1), { timeout: 1000 });

    // 10分間、タブが裏にある
    await act(async () => {
      vi.advanceTimersByTime(10 * 60_000);
    });
    process.stdout.write(`[measure] notifications requests while hidden for 10 minutes: ${vi.mocked(global.fetch).mock.calls.length - 1}\n`);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // 表示に戻ったら、1回だけ取り直す
    visibility.mockReturnValue("visible");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    visibility.mockRestore();
  });
});
