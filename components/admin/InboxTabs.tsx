"use client";

/**
 * 受信トレイの中のタブ（通知・通報・問い合わせ）。
 * 届いたものをまとめて「受信トレイ」として扱い、種類で切り替える。ページ（URL）はそれぞれ別なので、
 * ブックマークやダッシュボードからのリンクはそのまま使える。権限のないタブは出さない。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";

type InboxTab = { href: string; label: string; visible: (p: ReturnType<typeof useAuth>["permissions"]) => boolean };

export const INBOX_TABS: readonly InboxTab[] = [
  { href: "/admin/notifications", label: "通知", visible: (p) => p.isAdmin || p.canModerateContent },
  { href: "/admin/reports", label: "通報", visible: (p) => p.isModerator },
  { href: "/admin/inquiries", label: "問い合わせ", visible: (p) => p.isAdmin || p.canModerateContent },
];

export function InboxTabs() {
  const pathname = usePathname();
  const { permissions } = useAuth();
  const tabs = INBOX_TABS.filter((tab) => tab.visible(permissions));

  return (
    <nav aria-label="受信トレイの種類" className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
