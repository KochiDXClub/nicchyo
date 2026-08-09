"use client";

export const dynamic = "force-dynamic";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import { AdminLayout, AdminPageHeader, EmptyState } from "@/components/admin";
import { useAdminNotifications } from "@/lib/hooks/useAdminNotifications";
import { BroadcastEmailSection } from "./components/BroadcastEmailSection";
import { Bell } from "lucide-react";

const TYPE_ICONS: Record<string, string> = {
  new_application: "📝",
  system: "⚙️",
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export default function NotificationsPage() {
  const { permissions, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const canAccess = permissions.isAdmin || permissions.canModerateContent;

  const { notifications, unreadCount, markAllRead } = useAdminNotifications(canAccess);

  useEffect(() => {
    if (authLoading) return;
    if (!canAccess) router.push("/");
  }, [authLoading, canAccess, router]);

  // ページを開いたら全既読にする
  const handleMarkAllRead = useCallback(async () => {
    await markAllRead();
  }, [markAllRead]);

  if (authLoading || !canAccess) return null;

  return (
    <AdminLayout>
      <AdminPageHeader eyebrow="Notifications" title="通知" />

      <div className="mx-auto max-w-3xl px-4 py-8 pb-20">

        {permissions.isAdmin && <BroadcastEmailSection />}

        {/* ヘッダーアクション */}
        {unreadCount > 0 && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 px-5 py-3">
            <span className="text-sm text-orange-700">
              <Bell size={14} className="mr-1.5 inline" />
              未読通知が {unreadCount} 件あります
            </span>
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="rounded-lg bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700"
            >
              すべて既読にする
            </button>
          </div>
        )}

        {notifications.length === 0 ? (
          <EmptyState icon="🔔" title="通知はありません" description="新しい出店申請やことづて報告があるとここに表示されます。" />
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-4 rounded-xl border px-5 py-4 ${
                  n.is_read
                    ? "border-slate-200 bg-white"
                    : "border-orange-200 bg-orange-50"
                }`}
              >
                <span className="mt-0.5 text-2xl flex-shrink-0">
                  {TYPE_ICONS[n.type] ?? "🔔"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-semibold ${n.is_read ? "text-slate-700" : "text-slate-900"}`}>
                      {n.title}
                    </p>
                    <span className="shrink-0 text-xs text-slate-400">{formatDate(n.created_at)}</span>
                  </div>
                  {n.body && (
                    <p className="mt-0.5 text-sm text-slate-500">{n.body}</p>
                  )}
                  {n.link && (
                    <Link
                      href={n.link}
                      className="mt-1.5 inline-block text-xs text-blue-600 hover:underline"
                    >
                      詳細を確認 →
                    </Link>
                  )}
                </div>
                {!n.is_read && (
                  <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
