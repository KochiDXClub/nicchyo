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
import {
  ConsoleSidebar,
  type ConsoleSidebarAccent,
  type ConsoleSidebarItem,
  type ConsoleSidebarRailItem,
} from "@/components/navigation/ConsoleSidebar";
import { CountBadge } from "./CountBadge";
import { getVisibleAdminNav, isAdminNavItemCurrent, type AdminNavItem } from "@/lib/admin/adminNav";

/**
 * ロールごとのアクセント。
 * サイドバーは面で色を塗らないので、線と文字だけの控えめな指定にする。
 */
const ROLE_ACCENT: Record<string, ConsoleSidebarAccent> = {
  admin: { bar: "bg-red-500", icon: "text-red-600", dot: "bg-red-500" },
  moderator: { bar: "bg-purple-500", icon: "text-purple-600", dot: "bg-purple-500" },
};
const DEFAULT_ACCENT: ConsoleSidebarAccent = { bar: "bg-nicchyo-ink", icon: "text-nicchyo-ink", dot: "bg-nicchyo-ink/40" };

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
  // 見られるメインと、その配下（サブ）。PC の左列はメイン、サブは選んだメインの分だけ右に常に出す
  const visibleGroups = getVisibleAdminNav(permissions);
  const isItemCurrent = (item: AdminNavItem) => isAdminNavItemCurrent(item, pathname);
  const activeGroup = visibleGroups.find((group) => group.items.some(isItemCurrent)) ?? null;

  const toItem = (item: AdminNavItem): ConsoleSidebarItem => ({
    label: item.label,
    href: item.href,
    icon: item.icon,
    description: item.description,
    isActive: isItemCurrent(item),
    trailing: <CountBadge count={item.badgeKey === "inbox" ? inboxCount : 0} label={item.label} />,
  });

  // 配下に受信トレイ（新着）があるメインは、アイコンの右上に合計の件数を出す
  const railItems: ConsoleSidebarRailItem[] = visibleGroups.map((group) => ({
    id: group.id,
    label: group.label,
    href: group.items[0].href,
    icon: group.icon,
    isActive: group === activeGroup,
    trailing: group.items.some((item) => item.badgeKey === "inbox") ? (
      <CountBadge count={inboxCount} label={group.label} />
    ) : undefined,
  }));
  // サブ一覧はメインに2件以上あるときだけ（マップ編集のような1件だけのメインは出さない）
  const subPanel =
    activeGroup && activeGroup.items.length > 1
      ? { label: activeGroup.label, items: activeGroup.items.map(toItem) }
      : null;
  const groups = visibleGroups.map((group) => ({
    id: group.id,
    label: group.label,
    items: group.items.map(toItem),
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
      // PC ではアイコンだけのレールにし、カーソルを重ねた時だけ項目名を出す（Supabase 風）
      collapsible
      rail={railItems}
      subPanel={subPanel}
      homeHref="/admin/dashboard"
      homeLabel="nicchyo 管理ダッシュボードへ"
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
