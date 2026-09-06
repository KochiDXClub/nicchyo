/**
 * 管理者用レイアウト
 * 管理画面共通レイアウト
 */

"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";

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

  useEffect(() => {
    if (!isSidebarOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isSidebarOpen]);

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
