/**
 * 管理者用サイドバー
 * PC操作向けの固定ナビゲーション
 */

"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { getRoleTheme } from "@/lib/theme/roleTheme";
import { useAdminNotifications } from "@/lib/hooks/useAdminNotifications";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
  show?: boolean;
}

export const AdminSidebar = React.memo(function AdminSidebar({
  isOpen,
  onToggle,
  onClose,
}: {
  isOpen: boolean;
  onToggle?: () => void;
  onClose: () => void;
}) {
  const { user, permissions, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const theme = getRoleTheme(user?.role);
  const { unreadCount } = useAdminNotifications(permissions.isSuperAdmin || permissions.canModerateContent);

  const navItems: NavItem[] = [
    {
      label: "ダッシュボード",
      href: "/admin/dashboard",
      icon: "📊",
      show: permissions.isSuperAdmin,
    },
    {
      label: "アナリティクス",
      href: "/admin/analytics",
      icon: "📈",
      show: permissions.isSuperAdmin,
    },
    {
      label: "マップ編集",
      href: "/admin/map-edit",
      icon: "🗺️",
      show: permissions.isSuperAdmin,
    },
    {
      label: "ユーザー管理",
      href: "/admin/users",
      icon: "👥",
      show: permissions.isSuperAdmin,
    },
    {
      label: "コンテンツ管理",
      href: "/admin/content",
      icon: "📝",
      show: permissions.isSuperAdmin,
    },
    {
      label: "ことづて管理",
      href: "/admin/kotodute",
      icon: "💬",
      show: permissions.canModerateContent,
    },
    {
      label: "通報管理",
      href: "/admin/reports",
      icon: "🚩",
      show: permissions.isModerator,
    },
    {
      label: "問い合わせ管理",
      href: "/admin/inquiries",
      icon: "✉️",
      show: permissions.canModerateContent,
    },
    {
      label: "監査ログ",
      href: "/admin/audit-logs",
      icon: "🔍",
      show: permissions.isSuperAdmin,
    },
    {
      label: "通知",
      href: "/admin/notifications",
      icon: "🔔",
      badge: unreadCount > 0 ? unreadCount : undefined,
      show: permissions.isSuperAdmin || permissions.canModerateContent,
    },
    {
      label: "設定",
      href: "/admin/settings",
      icon: "⚙️",
      show: permissions.isSuperAdmin,
    },
  ].filter((item) => item.show !== false);

  const handleLogout = async () => {
    onClose();
    await logout();
    router.push("/map");
  };

  return (
    <>
      <button
        type="button"
        onClick={onToggle ?? onClose}
        className="fixed right-4 top-4 z-[10010] flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white/95 text-gray-700 shadow-lg backdrop-blur transition hover:bg-white active:scale-95 lg:hidden"
        aria-label="管理メニューを開く"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d={isOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[9998] bg-slate-950/30 backdrop-blur-[1px] lg:hidden"
          aria-label="サイドバーを閉じる"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-[9999] flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* ロゴ・ヘッダー */}
        <div className={`flex h-16 items-center justify-between px-6 ${theme.headerBg}`}>
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${theme.headerText} transition hover:bg-white/20`}
            aria-label="サイドバーを閉じる"
          >
            ✕
          </button>
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden="true">🗺️</span>
            <span className={`text-lg font-bold ${theme.headerText}`}>
              管理者ページ
            </span>
          </div>
        </div>

        {/* ユーザー情報 */}
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
              <span className="text-xl" aria-hidden="true">👤</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {user?.name || "管理者"}
              </p>
              <p className="text-xs text-gray-500">
                {permissions.isSuperAdmin ? "管理者" : "モデレーター"}
              </p>
            </div>
          </div>
        </div>

        {/* ナビゲーションメニュー */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          {navItems.map((item) => {
            const isDashboard = item.href === "/admin/dashboard";
            const isActive = isDashboard
              ? pathname === "/admin/dashboard" || pathname === "/admin"
              : pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 transition group ${
                  isActive
                    ? `${theme.accent.bg} ${theme.accent.text} shadow-sm`
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="flex-shrink-0 text-xl" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
                {item.badge && (
                  <span
                    className={`ml-auto rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isActive ? "bg-white bg-opacity-20" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4">
          <div className="grid gap-2">
            <Link
              href="/map"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
            >
              <span aria-hidden="true">🗺️</span>
              マップを開く
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <span aria-hidden="true">🚪</span>
              ログアウト
            </button>
          </div>
        </div>
      </aside>
    </>
  );
});
