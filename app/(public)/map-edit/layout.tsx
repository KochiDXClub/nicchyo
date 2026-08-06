"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";

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
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-cyan-50">
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="text-base font-semibold uppercase tracking-[0.3em] text-sky-700">Map Edit</p>
        <h1 className="mt-4 text-3xl font-bold text-slate-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-lg text-slate-600">{message}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-6 inline-flex items-center justify-center rounded-full bg-sky-600 px-6 py-3 text-sm font-semibold text-white shadow transition hover:bg-sky-500"
          >
            {cta.label}
          </Link>
        )}
      </div>
    </div>
  );
}

export default function MapEditLayout({ children }: { children: ReactNode }) {
  const { user, permissions, isLoading } = useAuth();

  if (isLoading) {
    return <GuardMessage title="読み込み中です" message="ログイン状態を確認しています。" />;
  }

  if (!user) {
    return (
      <GuardMessage
        title="ログインしてください"
        message="管理者専用ページです。ログイン後にご利用ください。"
        cta={{ href: "/login", label: "ログインへ" }}
      />
    );
  }

  if (!permissions.isAdmin) {
    return (
      <GuardMessage
        title="管理者専用です"
        message="管理者ロールのアカウントでログインしてください。"
        cta={{ href: "/", label: "トップへ戻る" }}
      />
    );
  }

  return <>{children}</>;
}
