"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import VendorAccessGate from "@/components/vendor/VendorAccessGate";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import VendorTourHost from "@/components/vendor/tour/VendorTourHost";
import { findVendorTourPage } from "@/lib/vendor/tours";
import { isAnalyticsOptedOut } from "@/lib/analytics/consentClient";

export default function MyShopLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/my-shop") return;
    // 解析を止めている端末では記録しない（/privacy のスイッチはここにも効く）
    if (isAnalyticsOptedOut()) return;

    const endpoint = "/api/analytics/home-visit";
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([], { type: "application/json" });
      navigator.sendBeacon(endpoint, blob);
      return;
    }

    void fetch(endpoint, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }, [pathname]);

  // にちよさんの質問ページは、にちよさんと質問だけを出す（下のナビも出さない）
  if (pathname === "/my-shop/ask") return <VendorAccessGate kicker="My shop">{children}</VendorAccessGate>;

  return (
    <VendorAccessGate kicker="My shop">
      {/* 下部ナビ（VendorNavBar）に隠れないよう、余白は /vendor のレイアウトと同じくここで持つ。
          各ページは自分で下の余白を足さない */}
      <div
        style={
          {
            paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))",
            // 画面の説明を開く「?」が見出しの右端に重ならないよう、PageTitle の右を空ける
            ...(findVendorTourPage(pathname) ? { "--page-title-end-gap": "3rem" } : {}),
          } as CSSProperties
        }
      >
        {children}
      </div>
      <VendorNavBar />
      <VendorTourHost />
    </VendorAccessGate>
  );
}
