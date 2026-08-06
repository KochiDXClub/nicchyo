"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import VendorNavBar from "@/components/vendor/VendorNavBar";

const GuardMessage = ({
  title,
  message,
  cta,
}: {
  title: string;
  message: string;
  cta?: { href: string; label: string };
}) => (
  <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50">
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-base font-semibold uppercase tracking-[0.3em] text-amber-700">
        My shop
      </p>
      <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
      <p className="mt-2 text-lg text-slate-600">{message}</p>
      {cta && (
        <Link
          href={cta.href}
          className="mt-6 inline-flex items-center justify-center rounded-full border border-amber-400 bg-amber-600 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow transition hover:bg-amber-500"
        >
          {cta.label}
        </Link>
      )}
    </div>
  </div>
);

export default function MyShopLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, permissions, isLoading } = useAuth();

  useEffect(() => {
    if (pathname !== "/my-shop") return;

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
        message="出店者専用のページです。ログインしてからご利用ください。"
        cta={{ href: "/login", label: "ログインへ" }}
      />
    );
  }

  if (!permissions.isVendor) {
    return (
      <GuardMessage
        title="出店者専用です"
        message="出店者ロールのアカウントでログインしてください。"
      />
    );
  }

  return (
    <>
      {children}
      <VendorNavBar />
    </>
  );
}
