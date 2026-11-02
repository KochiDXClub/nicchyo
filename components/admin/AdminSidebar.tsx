/**
 * 管理者用サイドバー
 *
 * 【設計方針】
 * - 項目は lib/admin/adminNav.ts の定義だけを描画する。ここに項目を直接書かない。
 * - 見出し付きのグループ表示にして、平坦な一覧の走査コストをなくす。
 * - 見た目は出店者ページと共通の ConsoleSidebar が受け持つ。ここは項目と色を組み立てるだけ。
 * - 配色はニュートラルを基調にし、ロール色は選択中インジケーターだけに使う。
 */

"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Map as MapIcon } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdminInboxCounts } from "@/lib/hooks/useAdminInboxCounts";
import { ConsoleSidebar, type ConsoleSidebarAccent } from "@/components/navigation/ConsoleSidebar";
import { CountBadge } from "./CountBadge";
import { getVisibleAdminNav, isAdminNavItemCurrent } from "@/lib/admin/adminNav";

/**
 * ロールごとのアクセント。
 * サイドバーは面で色を塗らないので、線と文字だけの控えめな指定にする。
 */
const ROLE_ACCENT: Record<string, ConsoleSidebarAccent> = {
  admin: { bar: "bg-red-500", icon: "text-red-600", dot: "bg-red-500" },
  moderator: { bar: "bg-purple-500", icon: "text-purple-600", dot: "bg-purple-500" },
};
const DEFAULT_ACCENT: ConsoleSidebarAccent = { bar: "bg-slate-900", icon: "text-slate-900", dot: "bg-slate-400" };

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
  // 受信トレイの新着（未読の通知＋未対応の通報・問い合わせ）。ページを移るたびに取り直す
  const { total: inboxCount } = useAdminInboxCounts(permissions.isAdmin || permissions.canModerateContent, pathname);

  const accent = ROLE_ACCENT[user?.role ?? ""] ?? DEFAULT_ACCENT;
  const groups = getVisibleAdminNav(permissions).map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      description: item.description,
      isActive: isAdminNavItemCurrent(item, pathname),
      trailing: <CountBadge count={item.badgeKey === "inbox" ? inboxCount : 0} label={item.label} />,
    })),
  }));
  const roleLabel = permissions.isAdmin ? "管理者" : "モデレーター";

  const handleLogout = async () => {
    onClose();
    await logout();
    router.push("/map");
  };

  return (
    <ConsoleSidebar
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
      menuLabel="管理メニュー"
      brandIcon={MapIcon}
      brandClassName="bg-slate-900"
      title="nicchyo"
      subtitle="管理コンソール"
      groups={groups}
      accent={accent}
      userName={user?.name || "管理者"}
      roleLabel={roleLabel}
      actions={[
        { label: "マップ", icon: MapIcon, href: "/map" },
        { label: "ログアウト", icon: LogOut, onClick: handleLogout },
      ]}
    />
  );
});
