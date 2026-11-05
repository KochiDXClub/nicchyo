"use client";

/**
 * 高知市向けページの外枠。管理画面（AdminLayout / AdminSidebar）と同じ ConsoleSidebar で、
 * 同じ見た目・同じ並びにする。項目は高知市向けの機能だけ（管理画面の項目は出さない）。
 */

import React, { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, LogOut, Map as MapIcon, BarChart3, Landmark, Megaphone } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthContext";
import { ConsoleSidebar, CONSOLE_SIDEBAR_OFFSET_CLASS } from "@/components/navigation/ConsoleSidebar";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";

const ACCENT = { bar: "bg-amber-500", icon: "text-amber-600", dot: "bg-amber-500" };

/** /city の2項目は同じページ内の見出しへ飛ぶので、選択中の表示は付けない。お知らせだけ別ページ */
const NAV_GROUPS = [
  {
    id: "city",
    label: "高知市",
    items: [
      { label: "開催ステータス", href: "/city#status", icon: CalendarDays, description: "日曜市の開催状況を更新する" },
      { label: "利用状況と記録", href: "/city#summary", icon: BarChart3, description: "来訪者数・開催実績・出店数を見る" },
      { label: "お知らせを出す", href: "/city/outbox", icon: Megaphone, description: "サイト内と出店者へお知らせを出す" },
    ],
  },
];

export function CityConsole({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, permissions, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);
  useBodyScrollLock(isOpen);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    router.push("/map");
  };

  return (
    <div className={`min-h-screen bg-slate-50 ${CONSOLE_SIDEBAR_OFFSET_CLASS}`}>
      <ConsoleSidebar
        isOpen={isOpen}
        onToggle={() => setIsOpen((v) => !v)}
        onClose={() => setIsOpen(false)}
        menuLabel="高知市メニュー"
        brandIcon={Landmark}
        brandClassName="bg-slate-900"
        title="nicchyo"
        subtitle="高知市のページ"
        groups={NAV_GROUPS.map((g) => ({
          ...g,
          items: g.items.map((item) => ({ ...item, isActive: item.href === pathname })),
        }))}
        accent={ACCENT}
        userName={user?.name || "高知市"}
        roleLabel={permissions.isAdmin ? "管理者" : "高知市"}
        actions={[
          { label: "マップ", icon: MapIcon, href: "/map" },
          { label: "ログアウト", icon: LogOut, onClick: handleLogout },
        ]}
      />
      <main className="min-h-screen pb-24">{children}</main>
    </div>
  );
}
