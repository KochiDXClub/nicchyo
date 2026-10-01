/**
 * 管理者用レイアウト
 * 管理画面共通レイアウト
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";

interface AdminLayoutProps {
  children: React.ReactNode;
  withBottomPadding?: boolean;
}

export const AdminLayout = React.memo(function AdminLayout({
  children,
  withBottomPadding = true,
}: AdminLayoutProps) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  // サイドバーを開いているあいだは背面を固定する（重なる固定と数を合わせる共通の仕組み）
  useBodyScrollLock(isSidebarOpen);

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-[248px]">
      <AdminSidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen((v) => !v)}
        onClose={() => setIsSidebarOpen(false)}
      />
      <main className={`min-h-screen ${withBottomPadding ? "pb-24" : ""}`}>{children}</main>
    </div>
  );
});
