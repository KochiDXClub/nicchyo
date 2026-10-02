"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import VendorSidebar from "@/components/vendor/VendorSidebar";
import VendorNavBar from "@/components/vendor/VendorNavBar";
import VendorTourHost from "@/components/vendor/tour/VendorTourHost";
import { findVendorTourPage } from "@/lib/vendor/tours";
import { useBodyScrollLock } from "@/lib/ui/bodyScrollLock";

/** 画面の説明を開く「?」が見出しの右端に重ならないよう、PageTitle の右を空ける（PageTitle が読む） */
const TOUR_BUTTON_GAP = { "--page-title-end-gap": "3rem" } as CSSProperties;

function GuardMessage({
  title,
  message,
  cta,
}: {
  title: string;
  message: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="text-base font-semibold uppercase tracking-[0.3em] text-amber-700">
          Vendor Dashboard
        </p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-lg text-slate-600">{message}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-amber-400"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function VendorLayout({ children }: { children: ReactNode }) {
  const { user, permissions, isLoading } = useAuth();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  // サイドバーを開いているあいだは背面を固定する（重なる固定と数を合わせる共通の仕組み）
  useBodyScrollLock(isSidebarOpen);

  if (isLoading) {
    return (
      <GuardMessage
        title="読み込み中です"
        message="ログイン状態を確認しています。しばらくお待ちください。"
      />
    );
  }

  if (!user) {
    return (
      <GuardMessage
        title="ログインしてください"
        message="出店者専用ページです。ログインしてからご利用ください。"
        cta={{ href: "/login", label: "ログインへ" }}
      />
    );
  }

  if (!permissions.isVendor) {
    return (
      <GuardMessage
        title="出店者専用です"
        message="出店者ロールのアカウントでログインしてください。"
        cta={{ href: "/", label: "トップへ戻る" }}
      />
    );
  }

  // 出店者ロールでも、店舗に入っていなければ使える画面がない（招待リンクかQRでの参加を案内する）
  if (!user.vendorId) {
    return (
      <GuardMessage
        title="お店に参加していません"
        message="お店の代表者からもらった招待リンク、または運営から渡されたQRコードで参加してください。"
        cta={{ href: "/", label: "トップへ戻る" }}
      />
    );
  }

  return (
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
  );
}
