"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import VendorAccessGate from "@/components/vendor/VendorAccessGate";
import VendorSidebar from "@/components/vendor/VendorSidebar";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import VendorTourHost from "@/components/vendor/tour/VendorTourHost";
import { findVendorTourPage } from "@/lib/vendor/tours";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";

/** 画面の説明を開く「?」が見出しの右端に重ならないよう、PageTitle の右を空ける（PageTitle が読む） */
const TOUR_BUTTON_GAP = { "--page-title-end-gap": "3rem" } as CSSProperties;

export default function VendorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  // サイドバーを開いているあいだは背面を固定する（重なる固定と数を合わせる共通の仕組み）
  useBodyScrollLock(isSidebarOpen);

  return (
    <VendorAccessGate kicker="Vendor Dashboard">
      <div className="min-h-screen bg-[#FFFAF0] lg:pl-72" style={findVendorTourPage(pathname) ? TOUR_BUTTON_GAP : undefined}>
        <VendorSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((v) => !v)}
          onClose={() => setIsSidebarOpen(false)}
        />
        <main
          className="min-h-screen pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0"
        >
          {children}
        </main>
        <VendorNavBar />
        <VendorTourHost />
      </div>
    </VendorAccessGate>
  );
}
