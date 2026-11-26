import { useState, useEffect, useCallback } from "react";

export type AdminNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

export function useAdminNotifications(enabled: boolean) {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetch_ = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) return;
      const json = await res.json() as { notifications: AdminNotification[] };
      setNotifications(json.notifications ?? []);
      setUnreadCount((json.notifications ?? []).filter((n) => !n.is_read).length);
    } catch {
      // ignore
    }
  }, [enabled]);

  useEffect(() => {
    fetch_();
    // 60秒ごとにポーリング。タブが裏にある間は取らず、表示に戻ったときに取り直す
    const interval = setInterval(() => {
      if (document.visibilityState !== "hidden") void fetch_();
    }, 60_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void fetch_();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetch_]);

  const markAllRead = useCallback(async () => {
    await fetch("/api/admin/notifications", { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, refresh: fetch_, markAllRead };
}
