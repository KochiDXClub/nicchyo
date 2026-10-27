"use client";

import { usePathname, useRouter } from "next/navigation";
import { House, LogOut, Map as MapIcon, Store } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  ConsoleSidebar,
  type ConsoleSidebarAccent,
  type ConsoleSidebarGroup,
} from "@/components/navigation/ConsoleSidebar";
import {
  isVendorNavItemCurrent,
  VENDOR_HOME_HREF,
  VENDOR_NAV_GROUP_LABELS,
  visibleVendorNavItems,
  type VendorNavItem,
} from "./vendorNavItems";

// 下部バーのメニューシートと同一の権威ある導線リストを使う（食い違い防止）。
// 見た目は管理画面と共通の ConsoleSidebar が受け持つ。色は出店者ページの主色（amber）を選択中の印にだけ使う

const VENDOR_ACCENT: ConsoleSidebarAccent = { bar: "bg-amber-500", icon: "text-amber-600", dot: "bg-amber-500" };

export default function VendorSidebar({
  isOpen,
  onToggle,
  onClose,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, permissions, logout } = useAuth();
  const navItems = visibleVendorNavItems(permissions.canShop);

  const toItems = (items: VendorNavItem[]) =>
    items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      description: item.description,
      isActive: isVendorNavItemCurrent(item.href, pathname),
    }));

  const groups: ConsoleSidebarGroup[] = [
    {
      id: "home",
      label: "ホーム",
      items: [
        {
          label: "マイ店舗",
          href: VENDOR_HOME_HREF,
          icon: House,
          description: "マイ店舗のホームにもどる",
          isActive: pathname === VENDOR_HOME_HREF,
        },
      ],
    },
    ...(Object.entries(VENDOR_NAV_GROUP_LABELS) as [VendorNavItem["group"], string][]).map(([group, label]) => ({
      id: group,
      label,
      items: toItems(navItems.filter((item) => item.group === group)),
    })),
  ].filter((group) => group.items.length > 0);

  const handleLogout = async () => {
    onClose();
    await logout();
    router.push("/login");
  };

  return (
    <ConsoleSidebar
      isOpen={isOpen}
      onToggle={onToggle}
      onClose={onClose}
      menuLabel="出店者メニュー"
      // スマホは下部バー（VendorNavBar）で代わりの導線を出すので、開閉ボタンは出さない
      showMobileToggle={false}
      brandIcon={Store}
      brandClassName="bg-amber-500"
      title="nicchyo"
      subtitle="出店者ページ"
      groups={groups}
      accent={VENDOR_ACCENT}
      userName={user?.name || "出店者"}
      roleLabel="出店者"
      actions={[
        { label: "マップを見る", icon: MapIcon, href: "/map" },
        { label: "ログアウト", icon: LogOut, onClick: handleLogout },
      ]}
    />
  );
}
