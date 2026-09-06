/**
 * 管理者用サイドバー
 *
 * 【設計方針】
 * - 項目は lib/admin/adminNav.ts の定義だけを描画する。ここに項目を直接書かない。
 * - 見出し付きのグループ表示にして、平坦な一覧の走査コストをなくす。
 * - アイコンは lucide-react のライン系で統一する（絵文字は使わない）。
 * - 配色はニュートラルを基調にし、ロール色は選択中インジケーターだけに使う。
 */

"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Map as MapIcon, Menu, PanelLeftClose, X } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdminNotifications } from "@/lib/hooks/useAdminNotifications";
import { getVisibleAdminNav, isAdminNavItemActive } from "@/lib/admin/adminNav";

/**
 * ロールごとのアクセント。
 * サイドバーは面で色を塗らないので、線と文字だけの控えめな指定にする。
 */
const ROLE_ACCENT: Record<string, { bar: string; icon: string; dot: string }> = {
  admin: { bar: "bg-red-500", icon: "text-red-600", dot: "bg-red-500" },
  moderator: { bar: "bg-purple-500", icon: "text-purple-600", dot: "bg-purple-500" },
};
const DEFAULT_ACCENT = { bar: "bg-slate-900", icon: "text-slate-900", dot: "bg-slate-400" };

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
  const { unreadCount } = useAdminNotifications(permissions.isAdmin || permissions.canModerateContent);

  const accent = ROLE_ACCENT[user?.role ?? ""] ?? DEFAULT_ACCENT;
  const groups = getVisibleAdminNav(permissions);
  const roleLabel = permissions.isAdmin ? "管理者" : "モデレーター";
  const displayName = user?.name || "管理者";
  const initial = displayName.slice(0, 1);

  const handleLogout = async () => {
    onClose();
    await logout();
    router.push("/map");
  };

  return (
    <>
      {/* モバイル用の開閉ボタン */}
      <button
        type="button"
        onClick={onToggle ?? onClose}
        className="fixed left-4 top-4 z-[10010] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:bg-white active:scale-95 lg:hidden"
        aria-label={isOpen ? "管理メニューを閉じる" : "管理メニューを開く"}
      >
        {isOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
      </button>

      {isOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-[9998] bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          aria-label="サイドバーを閉じる"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[9999] flex w-[248px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* ヘッダー */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-100 px-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-900 text-white">
            <MapIcon className="h-[16px] w-[16px]" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-slate-900">nicchyo</span>
            <span className="block truncate text-[11px] text-slate-400">管理コンソール</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
            aria-label="サイドバーを閉じる"
          >
            <PanelLeftClose className="h-[16px] w-[16px]" />
          </button>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="px-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = isAdminNavItemActive(item.href, pathname);
                  const Icon = item.icon;
                  const badge = item.badgeKey === "notifications" && unreadCount > 0 ? unreadCount : undefined;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        title={item.description}
                        aria-current={isActive ? "page" : undefined}
                        className={`group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
                          isActive
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        {isActive && (
                          <span
                            className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full ${accent.bar}`}
                            aria-hidden="true"
                          />
                        )}
                        <Icon
                          className={`h-[16px] w-[16px] shrink-0 transition-colors ${
                            isActive ? accent.icon : "text-slate-400 group-hover:text-slate-500"
                          }`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {badge !== undefined && (
                          <span className="ml-auto grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold tabular-nums text-white">
                            {badge > 99 ? "99+" : badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* フッター：ユーザー情報と操作 */}
        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-[13px] font-semibold uppercase text-slate-600">
              {initial}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-medium text-slate-900">{displayName}</span>
              <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} aria-hidden="true" />
                {roleLabel}
              </span>
            </span>
          </div>
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            <Link
              href="/map"
              onClick={onClose}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <MapIcon className="h-[14px] w-[14px]" aria-hidden="true" />
              マップ
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut className="h-[14px] w-[14px]" aria-hidden="true" />
              ログアウト
            </button>
          </div>
        </div>
      </aside>
    </>
  );
});
