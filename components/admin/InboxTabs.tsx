"use client";

/**
 * 受信トレイの中のタブ（通知・通報・問い合わせ）。
 * 届いたものをまとめて「受信トレイ」として扱い、種類で切り替える。ページ（URL）はそれぞれ別なので、
 * ブックマークやダッシュボードからのリンクはそのまま使える。権限のないタブは出さない。
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useAdminInboxCounts } from "@/lib/hooks/useAdminInboxCounts";
import type { InboxCounts } from "@/app/api/admin/inbox-counts/route";
import { CountBadge } from "./CountBadge";

type InboxTab = { href: string; label: string; countKey: keyof InboxCounts; visible: (p: ReturnType<typeof useAuth>["permissions"]) => boolean };

export const INBOX_TABS: readonly InboxTab[] = [
  { href: "/admin/notifications", label: "通知", countKey: "notifications", visible: (p) => p.isAdmin || p.canModerateContent },
  { href: "/admin/reports", label: "通報", countKey: "reports", visible: (p) => p.isModerator },
  { href: "/admin/inquiries", label: "問い合わせ", countKey: "inquiries", visible: (p) => p.isAdmin || p.canModerateContent },
];

export function InboxTabs() {
  const pathname = usePathname();
  const { permissions } = useAuth();
  const tabs = INBOX_TABS.filter((tab) => tab.visible(permissions));
  // 新着（未読の通知・未対応の通報・未対応の問い合わせ）を、タブごとに赤い数字で示す
  const { counts } = useAdminInboxCounts(permissions.isAdmin || permissions.canModerateContent, pathname);

  return (
    <nav aria-label="受信トレイの種類" className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? "border-nicchyo-ink text-nicchyo-ink"
                  : "border-transparent text-nicchyo-ink/55 hover:border-line hover:text-nicchyo-ink"
              }`}
            >
              {tab.label}
              <CountBadge count={counts[tab.countKey]} label={tab.label} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
